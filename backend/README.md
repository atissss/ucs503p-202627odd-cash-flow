# Intrinsic — Backend (FastAPI)

The API service for the Intrinsic DCF platform. It provides **user accounts**
(JWT auth) and stores **scenarios** (a named set of DCF assumptions plus the
client-computed valuation) in SQLite, **scoped per user**. The DCF math runs on
the frontend; the backend *stores* the valuation it receives and does not
recompute it. All errors share one envelope: `{"error": {"code", "message"}}`.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then set INTRINSIC_SECRET_KEY
uvicorn app.main:app --reload      # serves on http://localhost:8000
```

Check it: <http://localhost:8000/api/health> → `{"status":"ok",...}`.
Interactive docs: <http://localhost:8000/docs>.

## Configuration

Settings load from the environment (prefix `INTRINSIC_`) and an optional `.env`
(never committed — see `.env.example`): `SECRET_KEY`, `DATABASE_URL`,
`CORS_ORIGINS`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `FMP_API_KEY`
(required for ticker lookups; backend only). Tables are
created on startup; scenarios persist across restarts.

## Endpoints

**Auth** — get a token from `/login`, then send `Authorization: Bearer <token>`.

| Method | Path                 | Body                | Returns                     |
| ------ | -------------------- | ------------------- | --------------------------- |
| POST   | `/api/auth/register` | `{email, password}` | `201` user (id, email, …)   |
| POST   | `/api/auth/login`    | `{email, password}` | `200` `{access_token, ...}` |
| GET    | `/api/auth/me`       | — (Bearer)          | `200` current user          |

**Scenarios** — all scoped to the authenticated user; another user's id yields
`404` (never revealing the scenario exists). The `terminal_growth < wacc`
guardrail is enforced server-side (`422`).

| Method   | Path                  | Body             | Success |
| -------- | --------------------- | ---------------- | ------- |
| POST     | `/api/scenarios`      | `ScenarioCreate` | `201`   |
| GET      | `/api/scenarios`      | —                | `200`   |
| GET      | `/api/scenarios/{id}` | —                | `200`   |
| PUT      | `/api/scenarios/{id}` | `ScenarioUpdate` | `200`   |
| DELETE   | `/api/scenarios/{id}` | —                | `204`   |

**Financials** — requires a Bearer token. Looks up a ticker's latest annual
Financial Modeling Prep statements and returns them as `Assumptions`, with
monetary values and shares in millions. Free cash flow (operating cash flow −
capex), net debt (total debt − cash), diluted shares and currency are reported
figures; `growth_rate`, `wacc`, `terminal_growth` and `projection_years` are
placeholders for the user to set.

| Method | Path                       | Success | Body                 |
| ------ | -------------------------- | ------- | -------------------- |
| GET    | `/api/financials/{ticker}` | `200`   | `FinancialsResponse` |

```json
{
  "ticker": "AAPL",
  "data_status": "fetched",
  "as_of": "2025-09-27",
  "fetched_at": "2026-11-17T09:30:00Z",
  "assumptions": { "base_free_cash_flow": 98767.0, "net_debt": 76443.0, "...": "..." },
  "warnings": [{ "field": "base_free_cash_flow", "code": "zero_capex", "message": "..." }]
}
```

- `data_status` is `fetched` (just pulled), `cached` (within the 24 h TTL) or
  `stale` (past the TTL, served because the provider is failing; at most 7 days
  old). `fetched_at` is when the provider was actually called.
- `warnings` flag figures that passed validation but deserve a look:
  `non_positive_fcf`, `zero_capex`, `zero_balance_sheet`, `implausible_shares`,
  `mismatched_periods`, `outdated_statement`, `unknown_period`.

Every error means "no live data — fall back to manual entry"; `error.code` says why:

| Status | `error.code`              | Meaning                                                  |
| ------ | ------------------------- | -------------------------------------------------------- |
| `422`  | `invalid_ticker`          | Not a well-formed symbol (provider not called)           |
| `404`  | `ticker_not_found`        | Provider has no statements for it                        |
| `404`  | `ticker_not_covered`      | Not covered by our FMP plan (free tier: limited symbols) |
| `502`  | `invalid_data`            | Missing / zero / malformed required figures              |
| `502`  | `provider_error`          | Network failure, timeout, or provider error              |
| `503`  | `rate_limited`            | Provider quota hit; see `Retry-After`                    |
| `503`  | `provider_not_configured` | `INTRINSIC_FMP_API_KEY` is not set                       |

**Rate limits.** The free FMP tier allows 250 calls/day and each uncached lookup
costs 3 (one per statement; it stops at the first failure). Results are cached
in-process per ticker for 24 h; unknown, uncovered and invalid tickers for 1 h;
after a `429` the provider is not called for 5 min. All are tunable via
`INTRINSIC_FMP_*` settings (see `.env.example`). The cache is per process, so it
resets on restart.

The response models live in `app/financials/schemas.py`, not `app/models.py`,
since they are not part of the scenario contract. TS mirror for the frontend:

```ts
export interface DataWarning { field: string | null; code: string; message: string }
export interface FinancialsResponse {
  ticker: string
  data_status: 'fetched' | 'cached' | 'stale'
  as_of: string | null       // ISO date
  fetched_at: string         // ISO datetime, UTC
  assumptions: Assumptions   // snake_case on the wire
  warnings: DataWarning[]
}
```

## Test & lint

```bash
pytest          # auth, scenario and financials tests (no key or network needed)
ruff check .    # lint
```

## Layout

| Path                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `app/main.py`              | App wiring: CORS, logging, error handlers, startup, routers |
| `app/config.py`            | Settings (`pydantic-settings`, reads `.env`)              |
| `app/db.py`                | SQLModel engine, `get_session`, `init_db` (User + Scenario) |
| `app/errors.py`            | Consistent error-envelope handlers                        |
| `app/auth/`                | Password hashing, JWT, `get_current_user`, auth endpoints |
| `app/tables.py`            | `User` table                                              |
| `app/orm.py`               | `ScenarioTable`                                           |
| `app/repository.py`        | Scenario DB access (create/get/list/update/delete)        |
| `app/routers/scenarios.py` | Scenario CRUD endpoints (depend on `app.auth`)            |
| `app/financials/`          | FMP client, transform + validation, TTL cache, schemas    |
| `app/routers/financials.py` | Ticker lookup endpoint (depends on `app.auth`)          |
| `app/models.py`            | Pydantic contract + request models — mirror of the TS     |
| `tests/`                   | pytest (auth, scenarios, financials)                      |

The Pydantic models in `app/models.py` mirror `frontend/src/domain/scenario.ts`.
Change both together.
