"""Live financial data endpoint: turn a ticker into populated assumptions.

The handler stays thin: authenticate, delegate to the service, and translate its
errors into a 404 (unknown ticker) or 502 (provider failure).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..financials import service
from ..models import Assumptions

router = APIRouter(
    prefix="/api/financials",
    tags=["financials"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/{ticker}", response_model=Assumptions)
def read_financials(ticker: str) -> Assumptions:
    try:
        return service.fetch_assumptions(ticker)
    except service.TickerNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticker not found"
        ) from None
    except service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from None
