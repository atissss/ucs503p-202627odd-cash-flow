# Development guide — Intrinsic

Everything a teammate needs to run the project locally and the conventions we
agreed on in Week 1. **Intrinsic** is a DCF valuation & scenario-analysis
platform: assumptions in → intrinsic value per share out, with saveable
scenarios you can compare side by side.

## Prerequisites

- **Node.js 24+** and npm (frontend)
- **Python 3.12+** (backend)

## Run it locally

Two processes. Run each in its own terminal.

**Frontend** (Vite + React + TypeScript + Tailwind):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

**Backend** (FastAPI):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000
```

With both running, the header badge in the frontend flips to **“Backend
online”** — the Vite dev server proxies `/api/*` to the backend (see
`frontend/vite.config.ts`), so there is no origin to configure.

## Checks (what CI runs)

CI (`.github/workflows/ci.yml`) runs on every push and pull request:

| Stack    | Commands                                        |
| -------- | ------------------------------------------------ |
| frontend | `npm run lint` · `npm run test` · `npm run build` |
| backend  | `ruff check .` · `pytest -q`                      |

Run them locally before pushing so CI stays green.

## Project layout

```
frontend/              React + Vite + TS app
  src/domain/scenario.ts   Shared data model (source of truth)
  src/App.tsx              App shell
backend/               FastAPI service
  app/main.py              App + health endpoints
  app/models.py            Pydantic mirror of the data model
  tests/                   pytest smoke tests
.github/workflows/ci.yml   Build + lint pipeline
```

## The scenario data model (agreed convention)

The authoritative definition lives in code — **`frontend/src/domain/scenario.ts`**,
mirrored field-for-field in **`backend/app/models.py`**. Change both together.
Summary:

- **`Assumptions`** — the engine's inputs: `baseFreeCashFlow`, `growthRate`,
  `wacc`, `terminalGrowth`, `projectionYears`, `netDebt`, `sharesOutstanding`,
  `currency`. Rates are decimals (`0.09` = 9%); money is in millions of
  `currency`. Domain guardrail: `terminalGrowth < wacc`.
- **`ValuationOutput`** — the engine's result: per-year projection, terminal
  value, enterprise → equity value, and intrinsic value per share.
- **`Scenario`** — a named, saveable unit: `id`, `name`, `kind`, `dataStatus`,
  `ticker`, `assumptions`, `valuation`, timestamps.

### Status conventions

**`ScenarioKind`** — the qualitative case: `bull` · `base` · `bear` · `custom`.

**`DataStatus`** — provenance and health of the inputs (drives the Month-2 data
work):

| value     | meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `manual`  | every figure typed by the user                                 |
| `fetched` | pulled fresh from the finance API and passed validation        |
| `cached`  | served from local cache within its TTL                         |
| `stale`   | cached past its TTL — usable, should be refreshed              |
| `invalid` | fetched data failed validation → fall back to manual entry     |

**`ValuationStatus`** — health of the computed result: `ok` ·
`invalid-assumptions` (a guardrail was violated) · `not-computed`.
