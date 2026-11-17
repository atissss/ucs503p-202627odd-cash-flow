# Week 5 — Rebase onto frontend-ui & contract-level round-trip tests

**Date:** 2026-11-17
**Author:** Aatish Kumar Sahu (1024030790)
**Track:** Engine, testing & evaluation

## Goal
Move the sensitivity grid onto Bhavin's merged frontend (`frontend-ui`) and
make the round-trip tests exercise the real API boundary, not just JSON.

## What I did
- Branched `aatish/sensitivity-grid` from `origin/frontend-ui` (newest branch;
  its commit adds the case adapter `api/casing.ts`). Brought over my five
  files and added the Sensitivity section directly under Valuation, driven by
  the live `assumptions` state (+14 lines in `App.tsx`, nothing removed).
- Upgraded `scenario.roundtrip.test.ts`: the fake API now sends snake_case
  through the real `toSnakeCase`, stores snake_case rows, and returns them via
  the real `toCamelCase`. Added a wire-format test: no camelCase keys sent, no
  snake_case keys leaking back to the UI.
- Cross-checked the adapter's real output against the backend's Pydantic
  models (`ScenarioCreate`, `Assumptions`, `ValuationOutput`, `ProjectedYear`):
  all field names match. This was a throwaway check; no backend file touched.

## Decisions
- Kept the grid logic unchanged; only the integration and tests changed.
- Used the real adapter in tests so a future casing regression fails CI.

## Problems & fixes
- My Week 4 concern about the casing mismatch was already fixed by Bhavin's
  adapter; verified it rather than assuming.
- `sensgrid` had a modified `package-lock.json` (from `npm install`); to be
  restored from master. Use `npm ci` going forward.
- Vite showed `http proxy error: /api/health ECONNREFUSED`. Cause: the
  FastAPI backend was not running on port 8000. Start it with `uvicorn
  app.main:app --reload` (see `backend/README.md`).

## Verification
- `npm run lint` OK - `npm run test` OK (40/40: 9 existing + 31 new) -
  `npm run build` OK.
- Made `toSnakeCase` a no-op on purpose; the wire-format test failed as
  expected, then restored it.

## Not done yet
- Fetch -> validate -> save -> compare test: depends on Bhoomi's unmerged
  ticker-fetch and Bhavin's ticker UI.
- Pilot (10-20 users, 1-5 clarity ratings) and validation of engine output
  against reference valuations of known companies. Needs real participants and
  agreed reference figures.

## Next
- Build the pilot survey + analysis script and a reference-valuation harness
  for `runDCF`.
- Small PR so `runDCF` returns `invalid-assumptions` for `projectionYears < 1`.
