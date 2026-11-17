"""Turn a ticker into validated `Assumptions`: fetch, transform, validate, cache.

Only reported figures come from the provider: base free cash flow, net debt,
diluted shares and currency. The forward-looking rates and projection window are
the user's judgment, so they get the same placeholders as the frontend's
`DEFAULT_ASSUMPTIONS` in `frontend/src/domain/scenario.ts`.

FMP reports absolute units, while the shared contract holds monetary values in
millions. Shares are scaled the same way so value per share comes out correct.

Validation either rejects a lookup (`InvalidDataError`: a required figure is
missing, zero or malformed) or passes it with `warnings` for figures that are
usable but suspicious. FMP reports unreported figures as 0, so a zero where a
real company cannot have one is treated as missing.

Caching, to stay inside the provider's rate limit:
- A successful lookup is served from cache (`cached`) for `fmp_cache_ttl_seconds`.
- After that it is refetched; if the provider fails, the old result is served as
  `stale` for up to `fmp_stale_max_age_seconds`.
- Unknown, uncovered and invalid tickers are cached as errors for
  `fmp_negative_cache_ttl_seconds`, so repeating one does not spend calls.
- After a 429 the provider is not called again for
  `fmp_rate_limit_cooldown_seconds`.
"""

from __future__ import annotations

import logging
import math
import re
from datetime import UTC, date, datetime

from ..config import settings
from ..models import Assumptions
from . import client
from .cache import TTLCache
from .client import Statements
from .errors import (
    FinancialsError,
    InvalidDataError,
    InvalidTickerError,
    ProviderError,
    RateLimitedError,
    TickerNotCoveredError,
    TickerNotFoundError,
)
from .schemas import DataWarning, FinancialsResponse, LookupStatus

logger = logging.getLogger("intrinsic")

_UNITS_PER_MILLION = 1_000_000
# Exchange suffixes and share classes included, e.g. AAPL, BRK-B, RELIANCE.NS.
_TICKER_PATTERN = re.compile(r"[A-Z0-9][A-Z0-9.\-]{0,14}")
_CURRENCY_PATTERN = re.compile(r"[A-Z]{3}")
# Diluted shares, in millions, outside this range usually mean a scaling error.
_MIN_PLAUSIBLE_SHARES = 0.1
_MAX_PLAUSIBLE_SHARES = 100_000
_OUTDATED_AFTER_DAYS = 548  # about 18 months: a missed annual filing

DEFAULT_GROWTH_RATE = 0.08
DEFAULT_WACC = 0.09
DEFAULT_TERMINAL_GROWTH = 0.025
DEFAULT_PROJECTION_YEARS = 5

_cache: TTLCache[FinancialsResponse | FinancialsError] = TTLCache(
    settings.fmp_cache_max_entries
)
_cooldown_until = 0.0


def _today() -> date:
    return datetime.now(UTC).date()


def clear_cache() -> None:
    """Forget every cached lookup and any rate-limit cooldown."""
    global _cooldown_until
    _cache.clear()
    _cooldown_until = 0.0


def normalize_ticker(ticker: str) -> str:
    symbol = ticker.strip().upper()
    if not _TICKER_PATTERN.fullmatch(symbol):
        raise InvalidTickerError("Ticker must be 1-15 letters, digits, '.' or '-'")
    return symbol


def _read_number(record: dict, field: str, problems: list[str]) -> float:
    value = record.get(field)
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        problems.append(f"{field} is missing or not a number")
        return math.nan
    return float(value)


def _parse_date(value: object) -> date | None:
    try:
        return date.fromisoformat(value) if isinstance(value, str) else None
    except ValueError:
        return None


def transform(
    statements: Statements, *, today: date
) -> tuple[Assumptions, date | None, list[DataWarning]]:
    """Map the latest annual statements to `Assumptions`, the period end, and warnings.

    Raises `InvalidDataError` when a required figure is unusable.
    """
    records = (statements.cash_flow, statements.balance_sheet, statements.income)
    problems: list[str] = []
    operating_cash_flow = _read_number(statements.cash_flow, "operatingCashFlow", problems)
    capex = _read_number(statements.cash_flow, "capitalExpenditure", problems)
    total_debt = _read_number(statements.balance_sheet, "totalDebt", problems)
    cash = _read_number(statements.balance_sheet, "cashAndCashEquivalents", problems)
    shares = _read_number(statements.income, "weightedAverageShsOutDil", problems)

    currency = statements.cash_flow.get("reportedCurrency")
    if not isinstance(currency, str) or not _CURRENCY_PATTERN.fullmatch(currency):
        problems.append("reportedCurrency is missing or malformed")
    elif any(record.get("reportedCurrency") != currency for record in records):
        problems.append("statements are reported in different currencies")
    if operating_cash_flow == 0:
        problems.append("operatingCashFlow is zero")
    if shares <= 0:
        problems.append("weightedAverageShsOutDil is zero or negative")
    if problems:
        logger.warning("FMP statements failed validation: %s", "; ".join(problems))
        raise InvalidDataError(problems)

    # FMP reports capex as a negative outflow; abs() keeps this OCF minus capex
    # whichever sign the record uses.
    free_cash_flow = (operating_cash_flow - abs(capex)) / _UNITS_PER_MILLION
    net_debt = (total_debt - cash) / _UNITS_PER_MILLION
    shares_outstanding = shares / _UNITS_PER_MILLION

    warnings: list[DataWarning] = []

    def warn(field: str | None, code: str, message: str) -> None:
        warnings.append(DataWarning(field=field, code=code, message=message))

    if free_cash_flow <= 0:
        warn(
            "base_free_cash_flow",
            "non_positive_fcf",
            "Free cash flow is zero or negative, so a DCF on it needs a normalised figure.",
        )
    if capex == 0:
        warn(
            "base_free_cash_flow",
            "zero_capex",
            "Capital expenditure is reported as zero and may be missing; "
            "free cash flow may be overstated.",
        )
    if total_debt == 0 and cash == 0:
        warn(
            "net_debt",
            "zero_balance_sheet",
            "Debt and cash are both reported as zero and may be missing.",
        )
    if not _MIN_PLAUSIBLE_SHARES <= shares_outstanding <= _MAX_PLAUSIBLE_SHARES:
        warn(
            "shares_outstanding",
            "implausible_shares",
            f"{shares_outstanding:,.3f} million diluted shares is outside the usual range; "
            "check for a scaling error.",
        )

    as_of = _parse_date(statements.cash_flow.get("date"))
    if len({record.get("date") for record in records}) > 1:
        warn(None, "mismatched_periods", "The three statements cover different periods.")
    if as_of is None:
        warn(None, "unknown_period", "The statements do not say which period they cover.")
    elif (today - as_of).days > _OUTDATED_AFTER_DAYS:
        warn(
            None,
            "outdated_statement",
            f"The latest annual statement ends {as_of.isoformat()}, over 18 months ago.",
        )

    assumptions = Assumptions(
        base_free_cash_flow=free_cash_flow,
        growth_rate=DEFAULT_GROWTH_RATE,
        wacc=DEFAULT_WACC,
        terminal_growth=DEFAULT_TERMINAL_GROWTH,
        projection_years=DEFAULT_PROJECTION_YEARS,
        net_debt=net_debt,
        shares_outstanding=shares_outstanding,
        currency=currency,
    )
    return assumptions, as_of, warnings


def _refresh(symbol: str, now: float) -> FinancialsResponse:
    """Call the provider and cache the outcome, success or a lasting failure."""
    global _cooldown_until
    if now < _cooldown_until:
        raise RateLimitedError(
            "The financial data provider's rate limit was reached",
            retry_after=math.ceil(_cooldown_until - now),
        )
    try:
        statements = client.fetch_statements(symbol)
        assumptions, as_of, warnings = transform(statements, today=_today())
    except RateLimitedError:
        _cooldown_until = now + settings.fmp_rate_limit_cooldown_seconds
        raise
    except (TickerNotFoundError, TickerNotCoveredError, InvalidDataError) as exc:
        _cache.set(symbol, exc, settings.fmp_negative_cache_ttl_seconds)
        raise

    result = FinancialsResponse(
        ticker=symbol,
        data_status="fetched",
        as_of=as_of,
        fetched_at=datetime.now(UTC),
        assumptions=assumptions,
        warnings=warnings,
    )
    _cache.set(symbol, result, settings.fmp_cache_ttl_seconds)
    return result


def _served_as(result: FinancialsResponse, status: LookupStatus) -> FinancialsResponse:
    return result.model_copy(update={"data_status": status})


def get_financials(ticker: str) -> FinancialsResponse:
    """Look up a ticker, from cache when possible. Raises a `FinancialsError`."""
    symbol = normalize_ticker(ticker)
    now = _cache.clock()
    entry = _cache.get(symbol)

    if entry is not None and entry.is_fresh(now):
        if isinstance(entry.value, FinancialsError):
            raise entry.value.with_traceback(None)
        return _served_as(entry.value, "cached")

    try:
        return _refresh(symbol, now)
    except ProviderError:
        # A transient outage: an earlier good result beats no data at all.
        if (
            entry is not None
            and isinstance(entry.value, FinancialsResponse)
            and entry.age(now) < settings.fmp_stale_max_age_seconds
        ):
            logger.info("Serving stale financials for %s", symbol)
            return _served_as(entry.value, "stale")
        raise
