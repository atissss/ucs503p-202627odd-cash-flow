import { describe, expect, it } from 'vitest'

import { runDCF } from './runDCF'
import { DEFAULT_ASSUMPTIONS, type Assumptions } from './scenario'
import {
  HEAT_BUCKETS,
  buildSensitivity,
  centeredRange,
  defaultTerminalRange,
  defaultWaccRange,
  heatBucket,
  isCurrentCell,
  valueExtent,
} from './sensitivity'

/** Same hand-worked case as runDCF.test.ts (value/share at 10% / 2% is 152.5). */
const BASE: Assumptions = {
  baseFreeCashFlow: 100,
  growthRate: 0.1,
  wacc: 0.1,
  terminalGrowth: 0.02,
  projectionYears: 3,
  netDebt: 50,
  sharesOutstanding: 10,
  currency: 'USD',
}

// Ranges deliberately cross the g >= WACC diagonal.
const WACCS = [0.04, 0.06, 0.08, 0.1]
const TERMINALS = [0.02, 0.04, 0.06]

describe('buildSensitivity', () => {
  const grid = buildSensitivity(BASE, WACCS, TERMINALS)

  it('has one row per terminal-growth value and one column per WACC value', () => {
    expect(grid).toHaveLength(TERMINALS.length)
    for (const row of grid) expect(row).toHaveLength(WACCS.length)
  })

  it('labels each cell with its own (wacc, terminalGrowth) pair', () => {
    grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        expect(cell.terminalGrowth).toBe(TERMINALS[r])
        expect(cell.wacc).toBe(WACCS[c])
      }),
    )
  })

  it('is null exactly where terminalGrowth >= wacc', () => {
    for (const row of grid) {
      for (const cell of row) {
        if (cell.terminalGrowth >= cell.wacc) {
          expect(cell.valuePerShare).toBeNull()
        } else {
          expect(cell.valuePerShare).not.toBeNull()
        }
      }
    }
  })

  it('treats terminalGrowth === wacc as invalid (boundary)', () => {
    const [[cell]] = buildSensitivity(BASE, [0.04], [0.04])
    expect(cell.valuePerShare).toBeNull()
  })

  it('matches runDCF directly for spot-checked cells', () => {
    // row 0 (g = 2%), col 3 (WACC = 10%) is the hand-worked 152.5 case.
    expect(grid[0][3].valuePerShare).toBeCloseTo(152.5, 10)

    // row 1 (g = 4%), col 2 (WACC = 8%).
    const expected = runDCF({ ...BASE, wacc: 0.08, terminalGrowth: 0.04 })
    expect(expected.status).toBe('ok')
    expect(grid[1][2].valuePerShare).toBe(expected.intrinsicValuePerShare)
  })

  it('moves the right way: value falls as WACC rises, rises as g rises', () => {
    const g = buildSensitivity(BASE, [0.08, 0.09, 0.1, 0.11, 0.12], [0.01, 0.03])
    for (const row of g) {
      for (let c = 1; c < row.length; c++) {
        expect(row[c].valuePerShare!).toBeLessThan(row[c - 1].valuePerShare!)
      }
    }
    for (let c = 0; c < 5; c++) {
      expect(g[1][c].valuePerShare!).toBeGreaterThan(g[0][c].valuePerShare!)
    }
  })

  it('reuses every other assumption and does not mutate its input', () => {
    const frozen = Object.freeze({ ...BASE })
    const out = buildSensitivity(frozen, [0.1], [0.02])
    expect(out[0][0].valuePerShare).toBeCloseTo(152.5, 10)
    expect(frozen).toEqual(BASE)
  })

  it('returns an empty grid for empty ranges', () => {
    expect(buildSensitivity(BASE, [], [])).toEqual([])
    expect(buildSensitivity(BASE, WACCS, [])).toEqual([])
    expect(buildSensitivity(BASE, [], TERMINALS)).toEqual([[], [], []])
  })
})

describe('default ranges', () => {
  it('are 7 wide, centred on the current values, and ascending', () => {
    const waccs = defaultWaccRange(DEFAULT_ASSUMPTIONS)
    const terminals = defaultTerminalRange(DEFAULT_ASSUMPTIONS)
    expect(waccs).toEqual([0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12])
    expect(terminals).toEqual([0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04])
  })

  it('contain the current pair exactly, so the centre cell equals runDCF', () => {
    const a = DEFAULT_ASSUMPTIONS
    const grid = buildSensitivity(a, defaultWaccRange(a), defaultTerminalRange(a))
    const current = grid.flat().filter((cell) => isCurrentCell(cell, a))
    expect(current).toHaveLength(1)
    expect(current[0].valuePerShare).toBe(runDCF(a).intrinsicValuePerShare)
  })

  it('stay centred on awkward, non-round inputs', () => {
    const a = { ...DEFAULT_ASSUMPTIONS, wacc: 0.0937, terminalGrowth: 0.0231 }
    const grid = buildSensitivity(a, defaultWaccRange(a), defaultTerminalRange(a))
    expect(grid.flat().filter((cell) => isCurrentCell(cell, a))).toHaveLength(1)
  })
})

describe('centeredRange', () => {
  it('drops values at or below the floor', () => {
    // 2% WACC ± 3pp would reach -1%; only positive values survive.
    expect(centeredRange(0.02, 0.01, 3, 0)).toEqual([0.01, 0.02, 0.03, 0.04, 0.05])
  })

  it('returns [] for a non-finite centre (e.g. an empty form field)', () => {
    expect(centeredRange(NaN, 0.01)).toEqual([])
    expect(centeredRange(Infinity, 0.01)).toEqual([])
  })

  it('has no float noise', () => {
    expect(centeredRange(0.09, 0.01, 3)).toEqual([0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12])
  })
})

describe('valueExtent / heatBucket', () => {
  it('ignores null cells when finding min and max', () => {
    const grid = buildSensitivity(BASE, WACCS, TERMINALS)
    const values = grid.flat().flatMap((c) => (c.valuePerShare === null ? [] : [c.valuePerShare]))
    expect(valueExtent(grid)).toEqual({ min: Math.min(...values), max: Math.max(...values) })
  })

  it('is null when every cell is invalid', () => {
    expect(valueExtent(buildSensitivity(BASE, [0.02], [0.05]))).toBeNull()
    expect(valueExtent([])).toBeNull()
  })

  it('maps min to the lowest bucket and max to the highest', () => {
    expect(heatBucket(10, 10, 20)).toBe(0)
    expect(heatBucket(20, 10, 20)).toBe(HEAT_BUCKETS - 1)
  })

  it('is monotonic and stays inside 0…HEAT_BUCKETS-1', () => {
    let prev = -1
    for (let v = 0; v <= 100; v++) {
      const b = heatBucket(v, 0, 100)
      expect(b).toBeGreaterThanOrEqual(prev)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(HEAT_BUCKETS)
      prev = b
    }
  })

  it('puts a flat grid in the middle bucket', () => {
    expect(heatBucket(5, 5, 5)).toBe(2)
  })
})
