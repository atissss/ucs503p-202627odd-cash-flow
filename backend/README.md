# Intrinsic — Backend (FastAPI)

The API service for the Intrinsic DCF platform: SQLite persistence, user accounts
with JWT auth, and a consistent error envelope. Scenario CRUD and the finance-data
API integration land on top of this foundation.

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

The Vite dev server proxies `/api/*` to this service, so with both running the
frontend's "Backend online" indicator turns green.

## Configuration

Settings load from the environment / `.env` (prefix `INTRINSIC_`, see
`.env.example`): `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`,
`ACCESS_TOKEN_EXPIRE_MINUTES`. **Never commit `.env`** (it is gitignored).

## Auth endpoints

| Method | Path                 | Body                 | Returns                       |
| ------ | -------------------- | -------------------- | ----------------------------- |
| POST   | `/api/auth/register` | `{email, password}`  | `201` user (id, email, …)     |
| POST   | `/api/auth/login`    | `{email, password}`  | `200` `{access_token, ...}`   |
| GET    | `/api/auth/me`       | — (Bearer token)     | `200` current user            |

Send the token as `Authorization: Bearer <token>`. Errors use one envelope:
`{"error": {"code": "...", "message": ...}}` (`http_error`, `validation_error`,
`internal_error`).

Scenario endpoints depend on `app/auth/deps.py:get_current_user` for the current
user's `id` (used as `owner_id`).

## Test & lint

```bash
pytest          # smoke tests
ruff check .    # lint
```

## Layout

| Path                | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `app/main.py`       | App wiring: CORS, logging, error handlers, health, routers |
| `app/config.py`     | Settings (env / `.env`)                                   |
| `app/db.py`         | SQLModel engine, `get_session`, `init_db`                 |
| `app/tables.py`     | ORM tables (`User`; `Scenario` added by Person 1)         |
| `app/errors.py`     | Consistent error-envelope handlers                        |
| `app/auth/`         | Password hashing, JWT, `get_current_user`, auth endpoints |
| `app/models.py`     | Pydantic API models — mirror of the frontend's contract   |
| `tests/`            | pytest (health + auth)                                    |

The Pydantic models in `app/models.py` mirror `frontend/src/domain/scenario.ts`.
Change both together.
