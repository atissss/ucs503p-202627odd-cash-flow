/**
 * Intrinsic — shared scenario data model.
 *
 * This module is the single source of truth for the shapes that flow through
 * the whole app: assumptions in, valuation out, wrapped in a saveable scenario.
 * The backend Pydantic models in `backend/app/models.py` mirror these shapes
 * field-for-field, so the same JSON round-trips between the two.
 *
 * Nothing here has behaviour — it is types and conventions only. The `runDCF`
 * engine (Week 2) will consume `Assumptions` and produce `ValuationOutput`.
 */

/** ISO-4217 currency code, e.g. "USD". */
export type CurrencyCode = string

/**
 * The qualitative case a scenario represents. Analysts reason in optimistic /
 * base / pessimistic terms; `custom` covers anything that does not fit.
 */
export type ScenarioKind = 'bull' | 'base' | 'bear' | 'custom'

/**
 * Where a scenario's input data came from and how healthy it is. This is the
 * "status convention" the data-integration and validation work (Month 2) keys
 * off of.
 *
 * - `manual`   — every figure was typed by the user.
 * - `fetched`  — freshly pulled from the finance API and passed validation.
 * - `cached`   — served from the local cache within its TTL.
 * - `stale`    — cached data past its TTL; usable but should be refreshed.
 * - `invalid`  — fetched data failed validation (missing/zero/implausible);
 *                the UI falls back to manual entry.
 */
export type DataStatus = 'manual' | 'fetched' | 'cached' | 'stale' | 'invalid'

/**
 * The health of the computed valuation.
 *
 * - `ok`                  — assumptions are valid and produced a number.
 * - `invalid-assumptions` — a domain guardrail was violated (e.g. terminal
 *                           growth >= WACC), so no meaningful value exists.
 * - `not-computed`        — the engine has not run yet.
 */
export type ValuationStatus = 'ok' | 'invalid-assumptions' | 'not-computed'

/**
 * The inputs to a single valuation. All rates are decimals (0.09 = 9%), all
 * monetary values are in millions of `currency`, per-share figures excepted.
 */
export interface Assumptions {
  /** Free cash flow for the most recent year, the base the projection grows from. */
  baseFreeCashFlow: number
  /** Annual growth applied to free cash flow over the projection window. */
  growthRate: number
  /** Discount rate — the weighted average cost of capital. */
  wacc: number
  /** Perpetual growth rate used for the terminal value. Must be < `wacc`. */
  terminalGrowth: number
  /** Number of explicit years to project before the terminal value. */
  projectionYears: number
  /** Net debt (debt minus cash) subtracted from enterprise value. */
  netDebt: number
  /** Diluted shares outstanding, used to derive intrinsic value per share. */
  sharesOutstanding: number
  /** Currency the monetary figures are expressed in. */
  currency: CurrencyCode
}

/** One projected year in the explicit forecast window. */
export interface ProjectedYear {
  /** 1-based offset from the valuation date. */
  year: number
  /** Undiscounted free cash flow projected for the year. */
  freeCashFlow: number
  /** Discount factor applied to the year: 1 / (1 + wacc) ** year. */
  discountFactor: number
  /** `freeCashFlow * discountFactor`. */
  presentValue: number
}

/** The full result of running the DCF engine over a set of `Assumptions`. */
export interface ValuationOutput {
  status: ValuationStatus
  /** Per-year projection table. */
  projection: ProjectedYear[]
  /** Present value of the explicit projection window. */
  pvOfProjection: number
  /** Undiscounted terminal (perpetuity) value at the end of the window. */
  terminalValue: number
  /** Present value of the terminal value. */
  pvOfTerminalValue: number
  /** pvOfProjection + pvOfTerminalValue. */
  enterpriseValue: number
  /** enterpriseValue - netDebt. */
  equityValue: number
  /** equityValue / sharesOutstanding. */
  intrinsicValuePerShare: number
}

/**
 * A saved unit of analysis: a named set of assumptions, its (optional) computed
 * valuation, and the metadata needed to list, compare and reload it.
 */
export interface Scenario {
  /** Stable unique id (UUID) assigned by the backend on save. */
  id: string
  /** Human-readable name, e.g. "AAPL — Base case". */
  name: string
  kind: ScenarioKind
  dataStatus: DataStatus
  /** Ticker the assumptions were derived from, if any. */
  ticker: string | null
  assumptions: Assumptions
  /** Last computed valuation; null until the engine has run and been saved. */
  valuation: ValuationOutput | null
  /** ISO-8601 timestamps. */
  createdAt: string
  updatedAt: string
}

/** Payload sent when creating a scenario (server assigns id/timestamps). */
export type NewScenario = Pick<
  Scenario,
  'name' | 'kind' | 'dataStatus' | 'ticker' | 'assumptions' | 'valuation'
>

/**
 * A reasonable starting point for a blank scenario so the UI always has a valid
 * shape to render. Figures are illustrative placeholders, not a recommendation.
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  baseFreeCashFlow: 1000,
  growthRate: 0.08,
  wacc: 0.09,
  terminalGrowth: 0.025,
  projectionYears: 5,
  netDebt: 0,
  sharesOutstanding: 1000,
  currency: 'USD',
}
