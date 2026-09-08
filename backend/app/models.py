"""Pydantic models for the Intrinsic API.

These mirror the TypeScript contract in `frontend/src/domain/scenario.ts`
field-for-field so the same JSON round-trips between frontend and backend. Keep
the two in sync whenever the model changes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Status conventions (see the TS contract for the authoritative descriptions).
ScenarioKind = Literal["bull", "base", "bear", "custom"]
DataStatus = Literal["manual", "fetched", "cached", "stale", "invalid"]
ValuationStatus = Literal["ok", "invalid-assumptions", "not-computed"]


class Assumptions(BaseModel):
    """Inputs to a single valuation. Rates are decimals (0.09 == 9%)."""

    base_free_cash_flow: float
    growth_rate: float
    wacc: float
    terminal_growth: float
    projection_years: int = Field(ge=1, le=30)
    net_debt: float
    shares_outstanding: float = Field(gt=0)
    currency: str = "USD"


class ProjectedYear(BaseModel):
    year: int
    free_cash_flow: float
    discount_factor: float
    present_value: float


class ValuationOutput(BaseModel):
    status: ValuationStatus
    projection: list[ProjectedYear] = Field(default_factory=list)
    pv_of_projection: float
    terminal_value: float
    pv_of_terminal_value: float
    enterprise_value: float
    equity_value: float
    intrinsic_value_per_share: float


class Scenario(BaseModel):
    """A saved unit of analysis."""

    id: str
    name: str
    kind: ScenarioKind
    data_status: DataStatus
    ticker: str | None = None
    assumptions: Assumptions
    valuation: ValuationOutput | None = None
    created_at: datetime
    updated_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
