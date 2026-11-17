import { describe, expect, it } from 'vitest'

import { toCamelCase, toSnakeCase } from '../api/casing'
import { runDCF } from './runDCF'
import {
  DEFAULT_ASSUMPTIONS,
  type Assumptions,
  type NewScenario,
  type Scenario,
} from './scenario'
import {
  buildSensitivity,
  defaultTerminalRange,
  defaultWaccRange,
  isCurrentCell,
} from './sensitivity'

/**
 * In-memory stand-in for the scenarios API. It models the *wire contract*:
 * the client sends snake_case JSON (via the real `toSnakeCase` adapter the
 * app uses in `api/scenarios.ts`), the "server" stores snake_case rows, assigns
 * id + timestamps, and replies in snake_case, which the client converts back
 * with the real `toCamelCase`. Every hop crosses a JSON boundary, as `fetch` does.
 */
function createFakeScenarioApi() {
  const rows = new Map<string, string>() // id -> snake_case JSON text, like a DB row
  let seq = 0
  const json = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T

  return {
    /** Last request body the "server" received, for wire-format assertions. */
    lastRequest: null as Record<string, unknown> | null,

    create(payload: NewScenario): Scenario {
      const body = json<Record<string, unknown>>(toSnakeCase(payload)) // client -> wire
      this.lastRequest = body
      const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
      const now = '2026-11-17T10:00:00.000Z'
      const row = { id, ...body, created_at: now, updated_at: now }
      rows.set(id, JSON.stringify(row))
      return toCamelCase<Scenario>(json(row)) // wire -> client
    },
    get(id: string): Scenario {
      const row = rows.get(id)
      if (row === undefined) throw new Error('not found')
      return toCamelCase<Scenario>(JSON.parse(row))
    },
    list(): Scenario[] {
      return [...rows.values()].map((row) => toCamelCase<Scenario>(JSON.parse(row)))
    },
  }
}

/** What the UI does on "Save": snapshot the inputs plus the freshly computed valuation. */
function draftFrom(
  name: string,
  kind: NewScenario['kind'],
  assumptions: Assumptions,
): NewScenario {
  return {
    name,
    kind,
    dataStatus: 'manual',
    ticker: null,
    assumptions,
    valuation: runDCF(assumptions),
  }
}

describe('scenario save → reload round trip', () => {
  it('reloads a saved scenario deep-equal to what was saved', () => {
    const api = createFakeScenarioApi()
    const saved = api.create({ ...draftFrom('Base case', 'base', DEFAULT_ASSUMPTIONS), ticker: 'AAPL' })
    const reloaded = api.get(saved.id)

    expect(reloaded).toStrictEqual(saved)
  })

  it('preserves every field the user supplied, bit for bit', () => {
    const api = createFakeScenarioApi()
    const draft = draftFrom('Bull', 'bull', { ...DEFAULT_ASSUMPTIONS, growthRate: 0.123456789, wacc: 0.0937 })
    const reloaded = api.get(api.create(draft).id)

    expect(reloaded.assumptions).toStrictEqual(draft.assumptions)
    expect(reloaded.valuation).toStrictEqual(draft.valuation)
    expect(reloaded.name).toBe(draft.name)
    expect(reloaded.kind).toBe(draft.kind)
    expect(reloaded.dataStatus).toBe(draft.dataStatus)
  })

  it('sends snake_case keys on the wire and never leaks them back to the UI', () => {
    const api = createFakeScenarioApi()
    const saved = api.create(draftFrom('Base', 'base', DEFAULT_ASSUMPTIONS))

    const sent = api.lastRequest as { assumptions: Record<string, unknown>; data_status: string }
    expect(sent.assumptions).toHaveProperty('base_free_cash_flow')
    expect(sent).toHaveProperty('data_status')
    expect(JSON.stringify(sent)).not.toMatch(/"[a-z]+[A-Z][A-Za-z]*":/) // no camelCase key on the wire

    expect(saved.assumptions).toHaveProperty('baseFreeCashFlow')
    expect(JSON.stringify(saved)).not.toMatch(/"[a-z]+_[a-z]+":/) // no snake_case key in the UI
  })

  it('keeps null fields (no ticker, no valuation) rather than dropping them', () => {
    const api = createFakeScenarioApi()
    const reloaded = api.get(
      api.create({
        name: 'Draft',
        kind: 'custom',
        dataStatus: 'manual',
        ticker: null,
        assumptions: DEFAULT_ASSUMPTIONS,
        valuation: null,
      }).id,
    )

    expect(reloaded.ticker).toBeNull()
    expect(reloaded.valuation).toBeNull()
    expect(Object.keys(reloaded)).toEqual(expect.arrayContaining(['ticker', 'valuation']))
  })

  it('reloaded assumptions re-run to exactly the stored valuation', () => {
    const api = createFakeScenarioApi()
    const reloaded = api.get(api.create(draftFrom('Base', 'base', DEFAULT_ASSUMPTIONS)).id)

    expect(runDCF(reloaded.assumptions)).toStrictEqual(reloaded.valuation)
  })

  it('contains nothing JSON would silently corrupt (NaN, Infinity, undefined)', () => {
    const valuation = runDCF(DEFAULT_ASSUMPTIONS)
    const numbers = [
      valuation.pvOfProjection,
      valuation.terminalValue,
      valuation.pvOfTerminalValue,
      valuation.enterpriseValue,
      valuation.equityValue,
      valuation.intrinsicValuePerShare,
      ...valuation.projection.flatMap((y) => [y.freeCashFlow, y.discountFactor, y.presentValue]),
    ]
    for (const n of numbers) expect(Number.isFinite(n)).toBe(true)
    expect(JSON.parse(JSON.stringify(valuation))).toStrictEqual(valuation)
  })

  it('round-trips an invalid-assumptions valuation unchanged', () => {
    const invalid = { ...DEFAULT_ASSUMPTIONS, terminalGrowth: 0.1 } // g >= WACC
    const valuation = runDCF(invalid)
    expect(valuation.status).toBe('invalid-assumptions')
    expect(JSON.parse(JSON.stringify(valuation))).toStrictEqual(valuation)
  })
})

describe('happy path: assumptions → engine → save → reload → sensitivity', () => {
  it('flows end to end and stays self-consistent', () => {
    const api = createFakeScenarioApi()

    // 1. Analyst builds Bull / Base / Bear off the defaults and saves each.
    const base = DEFAULT_ASSUMPTIONS
    const bull = { ...base, growthRate: 0.12 }
    const bear = { ...base, growthRate: 0.03 }
    const ids = [
      api.create(draftFrom('Bull', 'bull', bull)).id,
      api.create(draftFrom('Base', 'base', base)).id,
      api.create(draftFrom('Bear', 'bear', bear)).id,
    ]

    // 2. They are all listed, and every valuation is a computed, finite number.
    const listed = api.list()
    expect(listed.map((s) => s.kind)).toEqual(['bull', 'base', 'bear'])
    for (const s of listed) {
      expect(s.valuation?.status).toBe('ok')
      expect(Number.isFinite(s.valuation?.intrinsicValuePerShare)).toBe(true)
    }

    // 3. The ordering analysts expect: bull > base > bear.
    const [vBull, vBase, vBear] = listed.map((s) => s.valuation!.intrinsicValuePerShare)
    expect(vBull).toBeGreaterThan(vBase)
    expect(vBase).toBeGreaterThan(vBear)

    // 4. Reload the base case and load its assumptions back into the workspace.
    const reloaded = api.get(ids[1])
    expect(reloaded.assumptions).toStrictEqual(base)

    // 5. The sensitivity grid for the reloaded inputs is centred on the saved value.
    const grid = buildSensitivity(
      reloaded.assumptions,
      defaultWaccRange(reloaded.assumptions),
      defaultTerminalRange(reloaded.assumptions),
    )
    const centre = grid.flat().find((cell) => isCurrentCell(cell, reloaded.assumptions))
    expect(centre?.valuePerShare).toBe(reloaded.valuation?.intrinsicValuePerShare)

    // 6. Editing WACC and re-saving yields a different, correctly recomputed valuation.
    const edited = api.create(draftFrom('Base, WACC 10%', 'custom', { ...base, wacc: 0.1 }))
    expect(edited.valuation!.intrinsicValuePerShare).toBeLessThan(vBase)
    expect(edited.id).not.toBe(ids[1])
  })
})
