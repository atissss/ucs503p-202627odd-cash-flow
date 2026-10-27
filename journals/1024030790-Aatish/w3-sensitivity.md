# Week 3 — Sensitivity grid & round-trip tests
 
**Date:** 2026-10-27
**Author:** Aatish Kumar Sahu (1024030790)
**Track:** Engine & testing
 
## Goal
Show how intrinsic value per share moves with WACC and terminal growth, and
add tests proving a saved scenario reloads identically.
 
## What I did
- Added `frontend/src/domain/sensitivity.ts`. `buildSensitivity(assumptions,
  waccRange, terminalRange)` calls `runDCF` for every (WACC, g) pair and
  returns a grid. Pairs the engine rejects (`terminalGrowth >= wacc`) come
  back as `null`, so the guardrail stays in one place (the engine).
- Built `components/SensitivityGrid.tsx`, a heatmap with five colour buckets
  (low to high), greyed-out cells for invalid pairs, and a ring on the cell
  matching the current assumptions. Added a "Sensitivity" section to `App.tsx`
  (import + one section only, to keep Bhavin's merge easy).
- Grid is centred on the user's current values: WACC +/-3 steps of 1.0 pp,
  terminal growth +/-3 steps of 0.5 pp (7x7).
- Tests (35 total, 30 new): grid dimensions, nulls on/past the diagonal,
  spot-checks against `runDCF`, centre cell equals the current valuation,
  component render test, and save -> reload -> deep-equal plus an
  assumptions -> engine -> save -> reload -> sensitivity happy path.
## Decisions
- Grid centred on current inputs, not fixed ranges, so the highlighted cell is
  always the real one.
- Round-trip tests use an in-memory fake API that sends data through JSON both
  ways. They check the frontend contract, not the backend.
## Problems & findings
- `master` has no `components/` folder or Valuation section; those are only on
  `demo/comparison`. Built the grid against a plain `assumptions` prop so it
  works on either. Dry-run onto `demo/comparison`: only `App.tsx` conflicts.
- Possible contract mismatch: backend models are snake_case
  (`base_free_cash_flow`) with no camelCase alias, while the TS types are
  camelCase. To raise with Bhoomi; not touched.
- `runDCF` throws a `TypeError` when `projectionYears < 1`. Probably
  unreachable (backend and form enforce >= 1) but worth returning
  `invalid-assumptions` instead.
## Verification
- `npm run lint` OK - `npm run test` OK (35/35) - `npm run build` OK.
- Broke the engine guardrail and the column order on purpose; tests failed as
  expected.