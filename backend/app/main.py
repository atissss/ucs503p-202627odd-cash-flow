"""Intrinsic API entrypoint.

Wires up CORS, creates the database tables on startup, and mounts the health
check plus the scenario CRUD router. Configuration comes from `app.config`.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .db import create_db_and_tables
from .models import HealthResponse
from .routers import scenarios

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables before the app starts serving requests.
    create_db_and_tables()
    yield


app = FastAPI(
    title="Intrinsic API",
    version=__version__,
    summary="DCF valuation and scenario storage for the Intrinsic platform.",
    lifespan=lifespan,
)

# During local dev the Vite server proxies `/api` to this service, but allow the
# dev origins directly too so the frontend can also call the API cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios.router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness probe used by CI, the frontend shell, and deployment checks."""
    return HealthResponse(status="ok", service="intrinsic-api", version=__version__)
