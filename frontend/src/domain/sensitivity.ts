import type { Assumptions } from './scenario'
import { runDCF } from './runDCF'

export interface SensitivityGridData {
  /** Growth rates down the rows, centred on the current assumption. */
  growths: number[]
  /** WACC values across the columns, centred on the current assumption. */
  waccs: number[]
  /** Intrinsic value per share for each [growthRow][waccCol]; null where invalid. */
  cells: (number | null)[][]
  /** Min / max across valid cells, for the heat scale. */
  lo: number
  hi: number
}

/**
 * Runs the DCF engine across a 5×5 grid of growth × WACC, centred on the
 * current assumptions, and returns the intrinsic value per share for each cell.
 * Cells where the guardrail fails (terminal growth ≥ WACC) are null.
 */
export function buildSensitivity(assumptions: Assumptions): SensitivityGridData {
  const growths = [-0.04, -0.02, 0, 0.02, 0.04].map((d) => assumptions.growthRate + d)
  const waccs = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => assumptions.wacc + d)
  const valid: number[] = []
  const cells = growths.map((growthRate) =>
    waccs.map((wacc) => {
      const result = runDCF({ ...assumptions, growthRate, wacc })
      const value =
        result.status === 'ok' && Number.isFinite(result.intrinsicValuePerShare)
          ? result.intrinsicValuePerShare
          : null
      if (value !== null) valid.push(value)
      return value
    }),
  )
  return {
    growths,
    waccs,
    cells,
    lo: valid.length ? Math.min(...valid) : 0,
    hi: valid.length ? Math.max(...valid) : 0,
  }
}
