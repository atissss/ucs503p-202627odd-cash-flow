/**
 * Intrinsic — the DCF valuation engine.
 *
 * Pure and side-effect-free: given the same `Assumptions`, always returns the
 * same `ValuationOutput`. No I/O, no mutation of the input. This is the only
 * place the discounted-cash-flow math lives; the UI (Week 3+) just calls it.
 */

import type { Assumptions, ProjectedYear, ValuationOutput } from './scenario'

const INVALID_ASSUMPTIONS_OUTPUT: ValuationOutput = {
  status: 'invalid-assumptions',
  projection: [],
  pvOfProjection: 0,
  terminalValue: 0,
  pvOfTerminalValue: 0,
  enterpriseValue: 0,
  equityValue: 0,
  intrinsicValuePerShare: 0,
}

/**
 * Projects free cash flow forward, discounts it and the Gordon-growth
 * terminal value back to present, and rolls up to intrinsic value per share.
 *
 * Enforces the one domain guardrail agreed in Week 1: `terminalGrowth` must
 * be strictly less than `wacc`, or the perpetuity formula divides by zero or
 * inverts sign and produces a meaningless terminal value.
 */
export function runDCF(assumptions: Assumptions): ValuationOutput {
  const {
    baseFreeCashFlow,
    growthRate,
    wacc,
    terminalGrowth,
    projectionYears,
    netDebt,
    sharesOutstanding,
  } = assumptions

  if (terminalGrowth >= wacc) {
    return INVALID_ASSUMPTIONS_OUTPUT
  }

  const projection: ProjectedYear[] = []
  for (let year = 1; year <= projectionYears; year++) {
    const freeCashFlow = baseFreeCashFlow * (1 + growthRate) ** year
    const discountFactor = 1 / (1 + wacc) ** year
    projection.push({
      year,
      freeCashFlow,
      discountFactor,
      presentValue: freeCashFlow * discountFactor,
    })
  }

  const pvOfProjection = projection.reduce((sum, y) => sum + y.presentValue, 0)

  const lastYear = projection[projection.length - 1]
  const terminalValue =
    (lastYear.freeCashFlow * (1 + terminalGrowth)) / (wacc - terminalGrowth)
  const pvOfTerminalValue = terminalValue * lastYear.discountFactor

  const enterpriseValue = pvOfProjection + pvOfTerminalValue
  const equityValue = enterpriseValue - netDebt
  const intrinsicValuePerShare = equityValue / sharesOutstanding

  return {
    status: 'ok',
    projection,
    pvOfProjection,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    intrinsicValuePerShare,
  }
}
