# Week 1 — Setup & Scaffolding

**Date:** 2026-08-31
**Author:** Bhavin Bhatti (1024030811)
**Milestone:** Month 1 · Week 1 — *empty but deployable app, CI green*

## Goal
Stand up the project skeleton so all three of us can run it locally: the
React + Vite + TypeScript frontend, a FastAPI backend, Tailwind, and CI that
builds and lints on every push. Also agree on the scenario data model.

## What I did
- Set up the frontend properly (React 19 + Vite + TS), replacing the starter
  template with an on-brand "Intrinsic" app shell.
- Added Tailwind CSS v4 via the `@tailwindcss/vite` plugin, with our colour
  tokens defined in one place (`src/index.css`).
- Built the FastAPI backend skeleton (`backend/`) with a `/health` endpoint and
  CORS, plus a dev proxy so the frontend calls `/api/*` with no origin config.
- Defined the shared **scenario data model** as a typed contract
  (`frontend/src/domain/scenario.ts`), mirrored in Pydantic
  (`backend/app/models.py`) — Assumptions -> ValuationOutput -> Scenario.
- Wrote the CI workflow (`.github/workflows/ci.yml`): frontend lint + build,
  backend ruff + pytest, on every push and PR.
- Wrote `DEVELOPMENT.md` so the team can run everything locally.

## Decisions / conventions agreed
- **Status conventions:** `ScenarioKind` (bull/base/bear/custom),
  `DataStatus` (manual/fetched/cached/stale/invalid), `ValuationStatus`.
- Rates stored as decimals (0.09 = 9%); money in millions.
- Domain guardrail to enforce later: terminal growth < WACC.
- TS types are the source of truth; Pydantic mirrors them field-for-field.

## Problems & fixes
- `ruff` failed initially on style (deprecated `Optional`, an over-long line).
  Fixed to `X | None` and reflowed -> clean.
- Confirmed the toolchain (Vite 8 / TS 6 / oxlint) builds green before and
  after changes.

## Verification
- frontend lint OK - frontend build OK - backend ruff OK - backend pytest OK
- Ran both servers together; the frontend health badge shows "Backend online",
  confirming the full request path works end to end.

## Next (Week 2)
- Implement `runDCF` as a pure, side-effect-free module and unit-test it
  against a hand-worked example. No UI — just correct numbers.
