# Intrinsic — Backend (FastAPI)

The API service for the Intrinsic DCF platform. It stores scenarios (a named set
of DCF assumptions plus the client-computed valuation) in SQLite, scoped per
user. The DCF math runs on the frontend; the backend **stores** the valuation it
receives and does not recompute it.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional — sensible defaults exist
uvicorn app.main:app --reload      # serves on http://localhost:8000
```

Check it: <http://localhost:8000/api/health> → `{"status":"ok",...}`.
Interactive docs: <http://localhost:8000/docs>.

The Vite dev server proxies `/api/*` to this service, so with both running the
frontend's "Backend online" indicator turns green.

## Configuration

Settings load from the environment (prefix `INTRINSIC_`) and an optional `.env`
file (never committed — see `.env.example`):

| Variable                  | Default                                             | Purpose                        |
| ------------------------- | --------------------------------------------------- | ------------------------------ |
| `INTRINSIC_DATABASE_URL`  | `sqlite:///./intrinsic.db`                          | SQLAlchemy database URL        |
| `INTRINSIC_CORS_ORIGINS`  | `http://localhost:5173,http://127.0.0.1:5173`       | Comma-separated CORS origins   |
| `INTRINSIC_SECRET_KEY`    | `dev-insecure-change-me`                            | Token signing (auth slice)     |

Tables are created automatically on app startup. Scenarios persist in the SQLite
file across restarts.

## Test & lint

```bash
pytest          # unit + endpoint tests
ruff check .    # lint
```

## Endpoints

All scenario endpoints are scoped to the current user and require the
`get_current_user` dependency. Bodies use the shared contract (snake_case). The
`terminal_growth < wacc` guardrail is enforced server-side (422 on violation).

| Method   | Path                     | Body            | Success | Notes                                   |
| -------- | ------------------------ | --------------- | ------- | --------------------------------------- |
| `POST`   | `/api/scenarios`         | `ScenarioCreate`| `201`   | Create; server assigns id + timestamps  |
| `GET`    | `/api/scenarios`         | —               | `200`   | List the current user's scenarios       |
| `GET`    | `/api/scenarios/{id}`    | —               | `200`   | Read one; `404` if missing/not-owned    |
| `PUT`    | `/api/scenarios/{id}`    | `ScenarioUpdate`| `200`   | Replace; `404` if missing/not-owned     |
| `DELETE` | `/api/scenarios/{id}`    | —               | `204`   | Delete; `404` if missing/not-owned      |

Invalid payloads (bad enum, missing field, guardrail violation) return `422`.
A user only ever sees or mutates their own scenarios; another user's id yields
`404` (never revealing that the scenario exists).

### Data model

A `Scenario` mirrors `frontend/src/domain/scenario.ts` field-for-field:

- `id`, `name`, `kind` (`bull|base|bear|custom`), `data_status`
  (`manual|fetched|cached|stale|invalid`), `ticker`, `created_at`, `updated_at`
- `assumptions` — `base_free_cash_flow`, `growth_rate`, `wacc`,
  `terminal_growth`, `projection_years`, `net_debt`, `shares_outstanding`,
  `currency`
- `valuation` — the client-computed `ValuationOutput` (or `null`)

In storage, `assumptions` and `valuation` are kept as JSON columns on the
`scenario` table (they are always read/written whole), alongside an indexed
`owner_id`.

> **Auth is stubbed.** `app/auth.py` currently returns a fixed dev user
> (`get_current_user`). When the users/auth slice lands, that one module is
> swapped for the real dependency and `owner_id` becomes a DB-level foreign key
> to the user table.

## Layout

| Path                        | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `app/main.py`               | FastAPI app, CORS, startup table creation, routers      |
| `app/config.py`             | Settings (`pydantic-settings`, reads `.env`)            |
| `app/db.py`                 | SQLModel engine, `get_session` dependency, table setup  |
| `app/auth.py`               | **Temporary** stub `get_current_user` (Person 2 owns)   |
| `app/models.py`             | Pydantic contract + request models — mirror of the TS   |
| `app/orm.py`                | SQLModel tables (`ScenarioTable`)                       |
| `app/repository.py`         | Scenario DB access (create/get/list/update/delete)      |
| `app/routers/scenarios.py`  | Scenario CRUD endpoints                                 |
| `tests/`                    | pytest unit + endpoint tests                            |

The Pydantic models in `app/models.py` mirror `frontend/src/domain/scenario.ts`.
Change both together.
