"""Tests for the FMP fetch, transform, validation and cache, with the provider mocked."""

from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.financials import client, errors, service
from app.financials.client import Statements

SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "fmp_aapl.json").read_text())
TEST_KEY = "test-key-not-real"
TODAY = date(2026, 11, 17)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def _statements(**overrides) -> Statements:
    """The three sample records, with field overrides applied wherever the field occurs."""
    records = [
        dict(SAMPLE["cash-flow-statement"][0]),
        dict(SAMPLE["balance-sheet-statement"][0]),
        dict(SAMPLE["income-statement"][0]),
    ]
    for record in records:
        for field, value in overrides.items():
            if field in record:
                record[field] = value
    return Statements(*records)


def _sample_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=SAMPLE[request.url.path.rsplit("/", 1)[-1]])


class Provider:
    """A mock FMP: records requests and answers with `handler`."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.handler = _sample_handler

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.handler(request)

    def respond(self, response: httpx.Response) -> None:
        self.handler = lambda request: response


@pytest.fixture(autouse=True)
def provider(monkeypatch) -> Provider:
    fake = Provider()
    monkeypatch.setattr(settings, "fmp_api_key", TEST_KEY)
    monkeypatch.setattr(client, "transport", httpx.MockTransport(fake))
    monkeypatch.setattr(service, "_today", lambda: TODAY)
    service.clear_cache()
    yield fake
    service.clear_cache()


@pytest.fixture
def clock(monkeypatch) -> FakeClock:
    fake = FakeClock()
    monkeypatch.setattr(service._cache, "clock", fake)
    return fake


# --- transform -------------------------------------------------------------


def test_transform_maps_sample_statements_to_assumptions():
    assumptions, as_of, warnings = service.transform(_statements(), today=TODAY)

    # Reported figures, scaled to millions per the shared contract.
    assert assumptions.base_free_cash_flow == pytest.approx(98_767.0)
    assert assumptions.net_debt == pytest.approx(76_443.0)
    assert assumptions.shares_outstanding == pytest.approx(15_004.697)
    assert assumptions.currency == "USD"
    # Judgment inputs stay at the placeholders, and remain valid together.
    assert assumptions.growth_rate == service.DEFAULT_GROWTH_RATE
    assert assumptions.wacc == service.DEFAULT_WACC
    assert assumptions.terminal_growth == service.DEFAULT_TERMINAL_GROWTH
    assert assumptions.projection_years == service.DEFAULT_PROJECTION_YEARS
    assert assumptions.terminal_growth < assumptions.wacc
    assert as_of == date(2025, 9, 27)
    assert warnings == []


@pytest.mark.parametrize("capex", [-12_715_000_000, 12_715_000_000])
def test_capex_is_subtracted_whichever_sign_it_has(capex):
    assumptions, _, _ = service.transform(_statements(capitalExpenditure=capex), today=TODAY)
    assert assumptions.base_free_cash_flow == pytest.approx(98_767.0)


@pytest.mark.parametrize(
    ("overrides", "problem"),
    [
        ({"operatingCashFlow": None}, "operatingCashFlow is missing"),
        ({"capitalExpenditure": "n/a"}, "capitalExpenditure is missing"),
        ({"totalDebt": True}, "totalDebt is missing"),
        ({"cashAndCashEquivalents": float("nan")}, "cashAndCashEquivalents is missing"),
        ({"weightedAverageShsOutDil": 0}, "weightedAverageShsOutDil is zero"),
        ({"weightedAverageShsOutDil": -5}, "weightedAverageShsOutDil is zero"),
        ({"operatingCashFlow": 0}, "operatingCashFlow is zero"),
        ({"reportedCurrency": None}, "reportedCurrency is missing"),
        ({"reportedCurrency": "dollars"}, "reportedCurrency is missing"),
    ],
)
def test_unusable_figures_are_rejected(overrides, problem):
    with pytest.raises(errors.InvalidDataError) as excinfo:
        service.transform(_statements(**overrides), today=TODAY)
    assert any(p.startswith(problem) for p in excinfo.value.problems)


def test_mixed_currencies_are_rejected():
    statements = _statements()
    statements.balance_sheet["reportedCurrency"] = "EUR"
    with pytest.raises(errors.InvalidDataError, match="different currencies"):
        service.transform(statements, today=TODAY)


def test_every_problem_is_reported_at_once():
    with pytest.raises(errors.InvalidDataError) as excinfo:
        service.transform(
            _statements(operatingCashFlow=None, weightedAverageShsOutDil=0), today=TODAY
        )
    assert len(excinfo.value.problems) == 2


@pytest.mark.parametrize(
    ("overrides", "code", "field"),
    [
        ({"capitalExpenditure": -200_000_000_000}, "non_positive_fcf", "base_free_cash_flow"),
        ({"capitalExpenditure": 0}, "zero_capex", "base_free_cash_flow"),
        ({"totalDebt": 0, "cashAndCashEquivalents": 0}, "zero_balance_sheet", "net_debt"),
        ({"weightedAverageShsOutDil": 15_004}, "implausible_shares", "shares_outstanding"),
        ({"date": "2024-09-28"}, "outdated_statement", None),
        ({"date": None}, "unknown_period", None),
    ],
)
def test_suspicious_figures_pass_with_a_warning(overrides, code, field):
    _, _, warnings = service.transform(_statements(**overrides), today=TODAY)
    assert [(w.code, w.field) for w in warnings] == [(code, field)]


def test_mismatched_statement_periods_are_flagged():
    statements = _statements()
    statements.income["date"] = "2024-09-28"
    _, _, warnings = service.transform(statements, today=TODAY)
    assert [w.code for w in warnings] == ["mismatched_periods"]


# --- fetching --------------------------------------------------------------


def test_lookup_requests_latest_record_of_each_statement(provider):
    result = service.get_financials(" aapl ")

    assert result.ticker == "AAPL"
    assert result.data_status == "fetched"
    assert result.as_of == date(2025, 9, 27)
    assert result.assumptions.base_free_cash_flow == pytest.approx(98_767.0)
    assert [r.url.path for r in provider.requests] == [
        "/stable/cash-flow-statement",
        "/stable/balance-sheet-statement",
        "/stable/income-statement",
    ]
    for request in provider.requests:
        assert request.url.host == "financialmodelingprep.com"
        assert request.url.params["symbol"] == "AAPL"
        assert request.url.params["limit"] == "1"
        assert request.url.params["apikey"] == TEST_KEY


@pytest.mark.parametrize("ticker", ["", "   ", "AA PL", "AAPL;DROP", "A" * 16, "-AAPL"])
def test_malformed_ticker_is_rejected_without_calling_provider(provider, ticker):
    with pytest.raises(errors.InvalidTickerError):
        service.get_financials(ticker)
    assert provider.requests == []


@pytest.mark.parametrize("ticker", ["BRK-B", "BRK.B", "RELIANCE.NS", "7203.T"])
def test_exchange_and_share_class_tickers_are_accepted(ticker):
    assert service.normalize_ticker(ticker.lower()) == ticker


def test_empty_response_means_unknown_ticker(provider):
    provider.respond(httpx.Response(200, json=[]))
    with pytest.raises(errors.TickerNotFoundError):
        service.get_financials("NOPE")
    assert len(provider.requests) == 1  # stops at the first statement


@pytest.mark.parametrize(
    ("response", "error"),
    [
        (httpx.Response(402, json={"Error Message": "Not on your plan."}), "TickerNotCoveredError"),
        (httpx.Response(429, json={"Error Message": "Limit reached."}), "RateLimitedError"),
        (httpx.Response(401, json={"Error Message": "Invalid API KEY."}), "ProviderError"),
        (httpx.Response(500, text="oops"), "ProviderError"),
        (httpx.Response(200, text="not json"), "ProviderError"),
        (httpx.Response(200, json={"Error Message": "Something else."}), "ProviderError"),
        (httpx.Response(200, json=[42]), "ProviderError"),
    ],
)
def test_provider_responses_map_to_errors(provider, response, error):
    provider.respond(response)
    with pytest.raises(errors.FinancialsError) as excinfo:
        service.get_financials("AAPL")
    assert type(excinfo.value).__name__ == error


def test_invalid_statements_raise_invalid_data(provider):
    def handler(request: httpx.Request) -> httpx.Response:
        rows = SAMPLE[request.url.path.rsplit("/", 1)[-1]]
        return httpx.Response(200, json=[{**rows[0], "weightedAverageShsOutDil": 0}])

    provider.handler = handler
    with pytest.raises(errors.InvalidDataError):
        service.get_financials("AAPL")


def test_missing_key_fails_without_calling_provider(provider, monkeypatch):
    monkeypatch.setattr(settings, "fmp_api_key", "")
    with pytest.raises(errors.ProviderNotConfiguredError):
        service.get_financials("AAPL")
    assert provider.requests == []


def test_network_failure_does_not_leak_key(provider, caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot connect to {request.url}")

    provider.handler = handler
    with caplog.at_level(logging.DEBUG), pytest.raises(errors.ProviderError) as excinfo:
        service.get_financials("AAPL")

    assert TEST_KEY not in str(excinfo.value)
    assert excinfo.value.__suppress_context__
    assert TEST_KEY not in caplog.text


def test_successful_fetch_does_not_log_key(caplog):
    with caplog.at_level(logging.INFO):
        service.get_financials("AAPL")
    assert TEST_KEY not in caplog.text


# --- caching ---------------------------------------------------------------


def test_repeat_lookup_is_served_from_cache(provider, clock):
    first = service.get_financials("AAPL")
    clock.advance(settings.fmp_cache_ttl_seconds - 1)
    second = service.get_financials("aapl")

    assert len(provider.requests) == 3
    assert second.data_status == "cached"
    assert second.fetched_at == first.fetched_at
    assert second.assumptions == first.assumptions


def test_expired_entry_is_refetched(provider, clock):
    service.get_financials("AAPL")
    clock.advance(settings.fmp_cache_ttl_seconds)

    assert service.get_financials("AAPL").data_status == "fetched"
    assert len(provider.requests) == 6


def test_provider_outage_serves_stale_result(provider, clock):
    service.get_financials("AAPL")
    clock.advance(settings.fmp_cache_ttl_seconds + 1)
    provider.respond(httpx.Response(500, text="down"))

    result = service.get_financials("AAPL")

    assert result.data_status == "stale"
    assert result.assumptions.base_free_cash_flow == pytest.approx(98_767.0)


def test_stale_result_expires(provider, clock):
    service.get_financials("AAPL")
    clock.advance(settings.fmp_stale_max_age_seconds)
    provider.respond(httpx.Response(500, text="down"))

    with pytest.raises(errors.ProviderError):
        service.get_financials("AAPL")


@pytest.mark.parametrize(
    ("response", "error"),
    [
        (httpx.Response(200, json=[]), errors.TickerNotFoundError),
        (httpx.Response(402, json={}), errors.TickerNotCoveredError),
    ],
)
def test_lasting_failures_are_cached_briefly(provider, clock, response, error):
    provider.respond(response)
    with pytest.raises(error):
        service.get_financials("NOPE")
    with pytest.raises(error):
        service.get_financials("NOPE")
    assert len(provider.requests) == 1

    clock.advance(settings.fmp_negative_cache_ttl_seconds)
    with pytest.raises(error):
        service.get_financials("NOPE")
    assert len(provider.requests) == 2


def test_rate_limit_pauses_provider_calls(provider, clock):
    provider.respond(httpx.Response(429, json={}))
    with pytest.raises(errors.RateLimitedError):
        service.get_financials("AAPL")

    provider.handler = _sample_handler
    clock.advance(10)
    with pytest.raises(errors.RateLimitedError) as excinfo:
        service.get_financials("MSFT")
    assert excinfo.value.retry_after == settings.fmp_rate_limit_cooldown_seconds - 10
    assert len(provider.requests) == 1

    clock.advance(settings.fmp_rate_limit_cooldown_seconds)
    assert service.get_financials("MSFT").data_status == "fetched"


def test_rate_limit_serves_stale_result(provider, clock):
    service.get_financials("AAPL")
    clock.advance(settings.fmp_cache_ttl_seconds)
    provider.respond(httpx.Response(429, json={}))

    assert service.get_financials("AAPL").data_status == "stale"


def test_cache_evicts_least_recently_used(monkeypatch, clock):
    small = service.TTLCache(max_entries=2, clock=clock)
    monkeypatch.setattr(service, "_cache", small)
    for ticker in ["AAPL", "MSFT", "AAPL", "GOOG"]:
        service.get_financials(ticker)

    assert small.get("AAPL") is not None
    assert small.get("MSFT") is None
    assert small.get("GOOG") is not None
