"""Intrinsic API entrypoint.

Week 1 is a skeleton: a health endpoint and CORS wired up so the frontend can
talk to it. The scenario CRUD endpoints and the finance-data integration land
in Month 2 (weeks 5–8).
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .models import HealthResponse

app = FastAPI(
    title="Intrinsic API",
    version=__version__,
    summary="DCF valuation and scenario storage for the Intrinsic platform.",
)

# During local dev the Vite server proxies `/api` to this service, but allow the
# dev origins directly too so the frontend can also call the API cross-origin.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_origins = [
    o.strip()
    for o in os.getenv("INTRINSIC_CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness probe used by CI, the frontend shell, and deployment checks."""
    return HealthResponse(status="ok", service="intrinsic-api", version=__version__)
