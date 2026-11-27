# Week 4 — Sensitivity grid & round-trip tests

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
- Built `components/SensitivityGrid.tsx`: a heatmap with five colour buckets
  (low to high), greyed-out cells for invalid pairs, and a ring on the cell
  matching the current assumptions. Added a "Sensitivity" section to `App.tsx`
  (one import + one section, to keep Bhavin's merge easy).
- Grid is centred on the user's current values: WACC +/-3 steps of 1.0 pp,
  terminal growth +/-3 steps of 0.5 pp (7x7).
- Tests: grid dimensions, nulls on and past the diagonal, spot-checks against
  `runDCF`, centre cell equals the current valuation, a component render test,
  and a save -> reload -> deep-equal round trip plus an assumptions -> engine
  -> save -> reload -> sensitivity happy path.

## Decisions
- Grid centred on current inputs rather than fixed ranges, so the highlighted
  cell is always the real one.
- Round-trip tests use an in-memory fake API that sends data through JSON both
  ways. They check the frontend contract, not the backend.

## Problems & findings
- `master` had no `components/` folder or Valuation section (those were only
  on `demo/comparison`), so I built the grid against a plain `assumptions`
  prop. A dry run onto `demo/comparison` conflicted only in `App.tsx`.
- Backend models were snake_case with no camelCase alias while the TS types
  are camelCase. Raised as a likely contract mismatch; not mine to change.
- `runDCF` throws a `TypeError` when `projectionYears < 1`. Probably
  unreachable (backend and form enforce >= 1) but it should return
  `invalid-assumptions` instead.
- Running `npm install` rewrote `package-lock.json` on my branch (78 lines
  removed). Lesson: use `npm ci` so the lockfile stays untouched.

## Verification
- `npm run lint` OK - `npm run test` OK (35/35) - `npm run build` OK.
- Broke the engine guardrail and the column order on purpose; tests failed as
  expected.

## Next
- Rebase onto Bhavin's frontend once it lands and move the section under
  Valuation.
- Restore the lockfile from master before pushing.
