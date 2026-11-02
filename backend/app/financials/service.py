"""Fetch a company's statements from Financial Modeling Prep (FMP) and transform them.

Only reported figures come from the provider: base free cash flow, net debt,
diluted shares and currency. The forward-looking rates and projection window are
the user's judgment, so they get the same placeholders as the frontend's
`DEFAULT_ASSUMPTIONS` in `frontend/src/domain/scenario.ts`.

FMP reports absolute units, while the shared contract holds monetary values in
millions. Shares are scaled the same way so value per share comes out correct.

FMP takes its key as a query parameter, so a request URL contains the secret.
httpx's request logging is turned down below, and errors raised or logged here
never include the URL or the original httpx exception.
"""

from __future__ import annotations

import logging

import httpx

from ..config import settings
from ..models import Assumptions

logger = logging.getLogger("intrinsic")
logging.getLogger("httpx").setLevel(logging.WARNING)

_TIMEOUT_SECONDS = 10.0
_UNITS_PER_MILLION = 1_000_000

DEFAULT_GROWTH_RATE = 0.08
DEFAULT_WACC = 0.09
DEFAULT_TERMINAL_GROWTH = 0.025
DEFAULT_PROJECTION_YEARS = 5


class TickerNotFoundError(Exception):
    """The provider has no statements for this ticker."""


class ProviderError(Exception):
    """The provider failed, or returned data we cannot use."""


def build_assumptions(cash_flow: dict, balance_sheet: dict, income: dict) -> Assumptions:
    """Map one annual record of each statement to the shared `Assumptions` shape."""
    try:
        # FMP reports capex as a negative outflow; abs() keeps this OCF minus capex
        # whichever sign the record uses.
        free_cash_flow = float(cash_flow["operatingCashFlow"]) - abs(
            float(cash_flow["capitalExpenditure"])
        )
        net_debt = float(balance_sheet["totalDebt"]) - float(
            balance_sheet["cashAndCashEquivalents"]
        )
        return Assumptions(
            base_free_cash_flow=free_cash_flow / _UNITS_PER_MILLION,
            growth_rate=DEFAULT_GROWTH_RATE,
            wacc=DEFAULT_WACC,
            terminal_growth=DEFAULT_TERMINAL_GROWTH,
            projection_years=DEFAULT_PROJECTION_YEARS,
            net_debt=net_debt / _UNITS_PER_MILLION,
            shares_outstanding=float(income["weightedAverageShsOutDil"]) / _UNITS_PER_MILLION,
            currency=cash_flow["reportedCurrency"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        # pydantic's ValidationError is a ValueError (e.g. zero shares).
        logger.warning("FMP statement could not be mapped: %s", type(exc).__name__)
        raise ProviderError("Provider returned unusable financial data") from None


def _fetch_latest(client: httpx.Client, endpoint: str, ticker: str) -> dict:
    """Return the latest annual record of one statement."""
    try:
        response = client.get(
            endpoint,
            params={"symbol": ticker, "limit": 1, "apikey": settings.fmp_api_key},
        )
    except httpx.HTTPError as exc:
        logger.warning("FMP %s request failed: %s", endpoint, type(exc).__name__)
        raise ProviderError("Could not reach the financial data provider") from None

    if not response.is_success:
        logger.warning("FMP %s returned HTTP %s", endpoint, response.status_code)
        raise ProviderError("The financial data provider returned an error")

    try:
        rows = response.json()
    except ValueError:
        logger.warning("FMP %s returned a non-JSON body", endpoint)
        raise ProviderError("Provider returned unusable financial data") from None

    # An unknown ticker comes back as a successful, empty list.
    if rows == []:
        raise TickerNotFoundError(ticker)
    if not isinstance(rows, list) or not isinstance(rows[0], dict):
        logger.warning("FMP %s returned an unexpected body", endpoint)
        raise ProviderError("Provider returned unusable financial data")
    return rows[0]


def fetch_assumptions(
    ticker: str, *, transport: httpx.BaseTransport | None = None
) -> Assumptions:
    """Build `Assumptions` for a ticker from its latest annual statements.

    `transport` lets tests replace the network with `httpx.MockTransport`.
    """
    if not settings.fmp_api_key:
        logger.warning("INTRINSIC_FMP_API_KEY is not set")
        raise ProviderError("The financial data provider is not configured")

    symbol = ticker.strip().upper()
    with httpx.Client(
        base_url=settings.fmp_base_url, timeout=_TIMEOUT_SECONDS, transport=transport
    ) as client:
        cash_flow = _fetch_latest(client, "cash-flow-statement", symbol)
        balance_sheet = _fetch_latest(client, "balance-sheet-statement", symbol)
        income = _fetch_latest(client, "income-statement", symbol)
    return build_assumptions(cash_flow, balance_sheet, income)
