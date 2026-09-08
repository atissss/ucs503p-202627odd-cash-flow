# Intrinsic — Backend (FastAPI)

The API service for the Intrinsic DCF platform. Week 1 is a skeleton: a health
endpoint plus the shared data model. Scenario storage (SQLite) and the finance
API integration arrive in Month 2.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # serves on http://localhost:8000
```

Check it: <http://localhost:8000/api/health> → `{"status":"ok",...}`.
Interactive docs: <http://localhost:8000/docs>.

The Vite dev server proxies `/api/*` to this service, so with both running the
frontend's "Backend online" indicator turns green.

## Test & lint

```bash
pytest          # smoke tests
ruff check .    # lint
```

## Layout

| Path             | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `app/main.py`    | FastAPI app, CORS, health endpoints                  |
| `app/models.py`  | Pydantic models — mirror of the frontend's contract  |
| `tests/`         | pytest smoke tests                                   |

The Pydantic models in `app/models.py` mirror `frontend/src/domain/scenario.ts`.
Change both together.
