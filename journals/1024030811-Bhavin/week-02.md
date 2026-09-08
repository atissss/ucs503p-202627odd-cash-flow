# Week 2 — DCF engine (pure module)

**Date:** 2026-09-07
**Author:** Bhavin Bhatti (1024030811)
**Milestone:** Month 1 · Week 2 — *tested engine that returns correct numbers*

## Goal
Build `runDCF` as a standalone, side-effect-free TypeScript module: projection,
discounting, terminal value, enterprise -> equity -> per-share. No UI yet.

## What I did
- Implemented `runDCF` in `frontend/src/domain/runDCF.ts`. It takes
  `Assumptions` and returns a `ValuationOutput`, with no I/O and no mutation
  of its input.
  - Projects free cash flow for `projectionYears`, discounting each year at
    `wacc`.
  - Computes a Gordon-growth terminal value off the final projected year and
    discounts it back with that year's discount factor.
  - Rolls up `pvOfProjection + pvOfTerminalValue -> enterpriseValue ->
    equityValue -> intrinsicValuePerShare`.
  - Enforces the Week 1 guardrail: `terminalGrowth >= wacc` short-circuits to
    `status: 'invalid-assumptions'` with zeroed output instead of dividing by
    zero or inverting sign.
- Added `vitest` to the frontend and wrote the first unit tests in
  `frontend/src/domain/runDCF.test.ts` against a hand-worked example
  (`baseFreeCashFlow=100, growthRate=wacc=10%, terminalGrowth=2%,
  projectionYears=3, netDebt=50, sharesOutstanding=10`), chosen so
  `growthRate === wacc` collapses each year's present value to exactly
  `baseFreeCashFlow` — easy to check by hand and a strong regression guard.
  Verified by hand: `pvOfProjection=300`, `terminalValue=1697.025`,
  `pvOfTerminalValue=1275`, `enterpriseValue=1575`, `equityValue=1525`,
  `intrinsicValuePerShare=152.5`. Also covered both invalid-assumptions cases
  (`terminalGrowth == wacc` and `> wacc`) and purity (no input mutation, same
  input -> same output).
- Wired `npm run test` into CI (`.github/workflows/ci.yml`) alongside lint and
  build, and into `DEVELOPMENT.md`'s checks table.

## Decisions / conventions agreed
- Terminal value is computed off the *last projected year's* FCF (already
  grown at `growthRate`), not off `baseFreeCashFlow` directly.
- Invalid assumptions return a fully zeroed `ValuationOutput` with an empty
  projection, rather than partial/undefined numbers — callers only ever get a
  well-formed shape to render.

## Problems & fixes
- None — numbers matched the hand-worked example on the first run once the
  terminal-value discount factor was pinned to the *final* projection year
  (not a separate `projectionYears + 1` factor).

## Verification
- `npm run lint` OK - `npm run test` OK (5/5) - `npm run build` OK.

## Next (Week 3)
- Wire `runDCF` into the UI: an assumptions form and a results view rendering
  the projection table and per-share value.
