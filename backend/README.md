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
`CORS_ORIGINS`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`. Tables are
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

## Test & lint

```bash
pytest          # auth + scenario (unit + endpoint) tests
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
| `app/models.py`            | Pydantic contract + request models — mirror of the TS     |
| `tests/`                   | pytest (auth + scenarios)                                 |

The Pydantic models in `app/models.py` mirror `frontend/src/domain/scenario.ts`.
Change both together.
