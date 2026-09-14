"""Intrinsic API entrypoint.

Wires together the app: CORS, request logging, a consistent error envelope,
database startup, and the auth router. Scenario CRUD (Person 1) and the
finance-data integration land later.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .auth.router import router as auth_router
from .config import settings
from .db import init_db
from .errors import register_exception_handlers
from .models import HealthResponse
from .scenarios.router import router as scenarios_router

logger = logging.getLogger("intrinsic")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Intrinsic API",
    version=__version__,
    summary="DCF valuation and scenario storage for the Intrinsic platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


app.include_router(auth_router)
app.include_router(scenarios_router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness probe used by CI, the frontend shell, and deployment checks."""
    return HealthResponse(status="ok", service="intrinsic-api", version=__version__)
