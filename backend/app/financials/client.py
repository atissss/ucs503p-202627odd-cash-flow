"""HTTP access to Financial Modeling Prep's stable statement endpoints.

One lookup reads the latest annual record of the cash-flow, balance-sheet and
income statements, stopping at the first failure so a bad ticker costs at most
one call against the free tier's 250-a-day limit.

FMP takes its key as a query parameter, so a request URL contains the secret.
httpx's request logging is turned down below, and errors raised or logged here
never include the URL or the original httpx exception.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from ..config import settings
from .errors import (
    ProviderError,
    ProviderNotConfiguredError,
    RateLimitedError,
    TickerNotCoveredError,
    TickerNotFoundError,
)

logger = logging.getLogger("intrinsic")
logging.getLogger("httpx").setLevel(logging.WARNING)

_TIMEOUT_SECONDS = 10.0

# None means the real network. Tests swap in an `httpx.MockTransport`.
transport: httpx.BaseTransport | None = None


@dataclass(frozen=True)
class Statements:
    """The latest annual record of each statement, as FMP returned it."""

    cash_flow: dict
    balance_sheet: dict
    income: dict


def _fetch_latest(client: httpx.Client, endpoint: str, symbol: str) -> dict:
    """Return the latest annual record of one statement."""
    try:
        response = client.get(
            endpoint,
            params={"symbol": symbol, "limit": 1, "apikey": settings.fmp_api_key},
        )
    except httpx.HTTPError as exc:
        logger.warning("FMP %s request failed: %s", endpoint, type(exc).__name__)
        raise ProviderError("Could not reach the financial data provider") from None

    if response.status_code == 402:
        # The free tier covers a subset of symbols; others answer 402.
        raise TickerNotCoveredError(symbol)
    if response.status_code == 429:
        logger.warning("FMP %s rate limit reached", endpoint)
        raise RateLimitedError(
            "The financial data provider's rate limit was reached",
            retry_after=settings.fmp_rate_limit_cooldown_seconds,
        )
    if not response.is_success:
        logger.warning("FMP %s returned HTTP %s", endpoint, response.status_code)
        raise ProviderError("The financial data provider returned an error")

    try:
        rows = response.json()
    except ValueError:
        logger.warning("FMP %s returned a non-JSON body", endpoint)
        raise ProviderError("The financial data provider returned an unreadable response") from None

    # An unknown ticker comes back as a successful, empty list.
    if rows == []:
        raise TickerNotFoundError(symbol)
    if not isinstance(rows, list) or not isinstance(rows[0], dict):
        logger.warning("FMP %s returned an unexpected body", endpoint)
        raise ProviderError("The financial data provider returned an unreadable response")
    return rows[0]


def fetch_statements(symbol: str) -> Statements:
    """Fetch the latest annual statements for an already-normalised symbol."""
    if not settings.fmp_api_key:
        logger.warning("INTRINSIC_FMP_API_KEY is not set")
        raise ProviderNotConfiguredError("The financial data provider is not configured")

    with httpx.Client(
        base_url=settings.fmp_base_url, timeout=_TIMEOUT_SECONDS, transport=transport
    ) as client:
        return Statements(
            cash_flow=_fetch_latest(client, "cash-flow-statement", symbol),
            balance_sheet=_fetch_latest(client, "balance-sheet-statement", symbol),
            income=_fetch_latest(client, "income-statement", symbol),
        )
