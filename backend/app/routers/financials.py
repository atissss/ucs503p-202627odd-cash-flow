"""Live financial data endpoint: turn a ticker into populated assumptions.

The handler stays thin: authenticate, delegate to the service, and translate its
errors into the shared error envelope with a specific code. Every error means
"no live data": the UI falls back to manual entry and uses the code to explain.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..auth import get_current_user
from ..errors import ApiError
from ..financials import errors, service
from ..financials.schemas import FinancialsResponse

router = APIRouter(
    prefix="/api/financials",
    tags=["financials"],
    dependencies=[Depends(get_current_user)],
)

# Most specific class first: the first match wins.
_ERROR_RESPONSES: list[tuple[type[errors.FinancialsError], int, str]] = [
    (errors.InvalidTickerError, status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_ticker"),
    (errors.TickerNotFoundError, status.HTTP_404_NOT_FOUND, "ticker_not_found"),
    (errors.TickerNotCoveredError, status.HTTP_404_NOT_FOUND, "ticker_not_covered"),
    (errors.InvalidDataError, status.HTTP_502_BAD_GATEWAY, "invalid_data"),
    (errors.RateLimitedError, status.HTTP_503_SERVICE_UNAVAILABLE, "rate_limited"),
    (
        errors.ProviderNotConfiguredError,
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "provider_not_configured",
    ),
    (errors.ProviderError, status.HTTP_502_BAD_GATEWAY, "provider_error"),
]

_MESSAGES: dict[type[errors.FinancialsError], str] = {
    errors.TickerNotFoundError: "Ticker not found",
    errors.TickerNotCoveredError: "Ticker is not covered by the financial data plan",
}


def _to_api_error(exc: errors.FinancialsError) -> ApiError:
    for error_type, status_code, code in _ERROR_RESPONSES:
        if isinstance(exc, error_type):
            headers = None
            if isinstance(exc, errors.RateLimitedError):
                headers = {"Retry-After": str(exc.retry_after)}
            return ApiError(status_code, code, _MESSAGES.get(error_type, str(exc)), headers)
    raise AssertionError(f"Unmapped financials error: {type(exc).__name__}")


@router.get("/{ticker}", response_model=FinancialsResponse)
def read_financials(ticker: str) -> FinancialsResponse:
    try:
        return service.get_financials(ticker)
    except errors.FinancialsError as exc:
        raise _to_api_error(exc) from None
