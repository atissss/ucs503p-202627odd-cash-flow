"""Response models for GET /api/financials/{ticker}.

These live outside `app/models.py` because they are not part of the scenario
contract mirrored in `frontend/src/domain/scenario.ts`; the UI consumes them only
to pre-fill a scenario's `assumptions` and `data_status`. The matching TS type is
in the backend README.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..models import Assumptions

# The subset of the shared `DataStatus` a lookup can produce. Data that fails
# validation is an error response, which the UI records as `invalid`.
LookupStatus = Literal["fetched", "cached", "stale"]


class DataWarning(BaseModel):
    """A figure that passed validation but deserves a second look before use."""

    field: str | None = Field(description="Assumptions field it concerns, if any.")
    code: str
    message: str


class FinancialsResponse(BaseModel):
    ticker: str
    data_status: LookupStatus
    as_of: date | None = Field(description="Period end of the statements used.")
    fetched_at: datetime = Field(description="When the provider was called (UTC).")
    assumptions: Assumptions
    warnings: list[DataWarning] = Field(default_factory=list)
