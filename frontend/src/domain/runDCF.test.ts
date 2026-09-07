import { describe, expect, it } from 'vitest'

import type { Assumptions } from './scenario'
import { runDCF } from './runDCF'

/**
 * Hand-worked example. Chosen so growthRate === wacc, which makes each
 * explicit year's present value collapse to exactly `baseFreeCashFlow`
 * (PV_t = base*(1+g)^t / (1+wacc)^t = base when g === wacc) — easy to verify
 * by hand and a strong regression check.
 *
 *   Year 1: FCF = 100 * 1.10^1 = 110,    DF = 1/1.10^1 = 0.909090909..., PV = 100
 *   Year 2: FCF = 100 * 1.10^2 = 121,    DF = 1/1.10^2 = 0.826446281..., PV = 100
 *   Year 3: FCF = 100 * 1.10^3 = 133.1,  DF = 1/1.10^3 = 0.751314801..., PV = 100
 *
 *   pvOfProjection    = 300
 *   terminalValue     = FCF_3 * (1 + tg) / (wacc - tg) = 133.1 * 1.02 / 0.08 = 1697.025
 *   pvOfTerminalValue = terminalValue * DF_3 = 1697.025 / 1.331 = 1275
 *   enterpriseValue   = 300 + 1275 = 1575
 *   equityValue       = 1575 - 50 = 1525
 *   intrinsicValuePerShare = 1525 / 10 = 152.5
 */
const HAND_WORKED_ASSUMPTIONS: Assumptions = {
  baseFreeCashFlow: 100,
  growthRate: 0.1,
  wacc: 0.1,
  terminalGrowth: 0.02,
  projectionYears: 3,
  netDebt: 50,
  sharesOutstanding: 10,
  currency: 'USD',
}

describe('runDCF', () => {
  it('matches the hand-worked example year by year', () => {
    const result = runDCF(HAND_WORKED_ASSUMPTIONS)

    expect(result.status).toBe('ok')
    expect(result.projection).toHaveLength(3)

    expect(result.projection[0].freeCashFlow).toBeCloseTo(110, 9)
    expect(result.projection[0].discountFactor).toBeCloseTo(1 / 1.1, 9)
    expect(result.projection[0].presentValue).toBeCloseTo(100, 9)

    expect(result.projection[1].freeCashFlow).toBeCloseTo(121, 9)
    expect(result.projection[1].presentValue).toBeCloseTo(100, 9)

    expect(result.projection[2].freeCashFlow).toBeCloseTo(133.1, 9)
    expect(result.projection[2].presentValue).toBeCloseTo(100, 9)
  })

  it('matches the hand-worked rollup to intrinsic value per share', () => {
    const result = runDCF(HAND_WORKED_ASSUMPTIONS)

    expect(result.pvOfProjection).toBeCloseTo(300, 9)
    expect(result.terminalValue).toBeCloseTo(1697.025, 9)
    expect(result.pvOfTerminalValue).toBeCloseTo(1275, 9)
    expect(result.enterpriseValue).toBeCloseTo(1575, 9)
    expect(result.equityValue).toBeCloseTo(1525, 9)
    expect(result.intrinsicValuePerShare).toBeCloseTo(152.5, 9)
  })

  it('is pure: does not mutate its input and is deterministic', () => {
    const input = { ...HAND_WORKED_ASSUMPTIONS }
    const first = runDCF(input)
    const second = runDCF(input)

    expect(input).toEqual(HAND_WORKED_ASSUMPTIONS)
    expect(second).toEqual(first)
  })

  it('flags invalid-assumptions when terminal growth equals wacc', () => {
    const result = runDCF({ ...HAND_WORKED_ASSUMPTIONS, terminalGrowth: 0.1 })

    expect(result.status).toBe('invalid-assumptions')
    expect(result.projection).toEqual([])
    expect(result.intrinsicValuePerShare).toBe(0)
  })

  it('flags invalid-assumptions when terminal growth exceeds wacc', () => {
    const result = runDCF({ ...HAND_WORKED_ASSUMPTIONS, terminalGrowth: 0.15 })

    expect(result.status).toBe('invalid-assumptions')
  })
})
