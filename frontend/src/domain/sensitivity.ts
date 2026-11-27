/**
 * Intrinsic — WACC × terminal-growth sensitivity analysis.
 *
 * Pure helpers behind the sensitivity heatmap. Every cell is produced by
 * calling `runDCF` — the engine stays the single source of truth for both the
 * maths and the `terminalGrowth < wacc` guardrail, so this module never
 * re-implements either.
 */

import { runDCF } from './runDCF'
import type { Assumptions } from './scenario'

/** One (WACC, terminal growth) pair and the value it produces. */
export interface SensitivityCell {
  wacc: number
  terminalGrowth: number
  /** Intrinsic value per share, or `null` when the pair is invalid (e.g. g >= WACC). */
  valuePerShare: number | null
}

/** Indexed `[row][col]`: rows are terminal growth, columns are WACC. */
export type SensitivityGrid = SensitivityCell[][]

/** Default grid shape: ±3 steps around the user's current values (7 × 7). */
export const WACC_STEP = 0.01
export const TERMINAL_STEP = 0.005
export const STEPS_EACH_SIDE = 3

/** Number of colour buckets on the low → high scale. */
export const HEAT_BUCKETS = 5

const ROUND_DP = 6
const MATCH_TOLERANCE = 1e-9

/**
 * `2 * stepsEachSide + 1` evenly spaced values centred on `center`, ascending.
 * The centre is returned untouched so it matches the user's input exactly;
 * the others are rounded to kill float noise (0.09 - 0.03 → 0.06, not 0.0599…).
 * Values at or below `floor` are dropped (e.g. WACC must stay positive).
 */
export function centeredRange(
  center: number,
  step: number,
  stepsEachSide: number = STEPS_EACH_SIDE,
  floor: number = -Infinity,
): number[] {
  if (!Number.isFinite(center)) return []
  const values: number[] = []
  for (let k = -stepsEachSide; k <= stepsEachSide; k++) {
    const v = k === 0 ? center : Number((center + k * step).toFixed(ROUND_DP))
    if (v > floor) values.push(v)
  }
  return values
}

/** Default WACC columns for the given assumptions (positive values only). */
export function defaultWaccRange(assumptions: Assumptions): number[] {
  return centeredRange(assumptions.wacc, WACC_STEP, STEPS_EACH_SIDE, 0)
}

/** Default terminal-growth rows for the given assumptions. */
export function defaultTerminalRange(assumptions: Assumptions): number[] {
  return centeredRange(assumptions.terminalGrowth, TERMINAL_STEP, STEPS_EACH_SIDE)
}

/**
 * Runs the DCF for every (WACC, terminal growth) pair, reusing `assumptions`
 * for everything else. Pairs the engine rejects — or that yield a non-finite
 * number — come back with `valuePerShare: null`.
 */
export function buildSensitivity(
  assumptions: Assumptions,
  waccRange: readonly number[],
  terminalRange: readonly number[],
): SensitivityGrid {
  return terminalRange.map((terminalGrowth) =>
    waccRange.map((wacc): SensitivityCell => {
      const result = runDCF({ ...assumptions, wacc, terminalGrowth })
      const usable =
        result.status === 'ok' && Number.isFinite(result.intrinsicValuePerShare)
      return {
        wacc,
        terminalGrowth,
        valuePerShare: usable ? result.intrinsicValuePerShare : null,
      }
    }),
  )
}

/** Min and max across the valid cells, or `null` if there are none. */
export function valueExtent(
  grid: SensitivityGrid,
): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const row of grid) {
    for (const { valuePerShare } of row) {
      if (valuePerShare === null) continue
      if (valuePerShare < min) min = valuePerShare
      if (valuePerShare > max) max = valuePerShare
    }
  }
  return min <= max ? { min, max } : null
}

/**
 * Maps a value onto `0 … HEAT_BUCKETS - 1` (low → high) by its position within
 * `[min, max]`. A flat grid (min === max) lands in the middle bucket.
 */
export function heatBucket(value: number, min: number, max: number): number {
  if (max <= min) return Math.floor(HEAT_BUCKETS / 2)
  const t = (value - min) / (max - min)
  return Math.min(HEAT_BUCKETS - 1, Math.max(0, Math.floor(t * HEAT_BUCKETS)))
}

/** True when the cell is the user's current WACC / terminal-growth pair. */
export function isCurrentCell(
  cell: Pick<SensitivityCell, 'wacc' | 'terminalGrowth'>,
  assumptions: Pick<Assumptions, 'wacc' | 'terminalGrowth'>,
): boolean {
  return (
    Math.abs(cell.wacc - assumptions.wacc) < MATCH_TOLERANCE &&
    Math.abs(cell.terminalGrowth - assumptions.terminalGrowth) < MATCH_TOLERANCE
  )
}
