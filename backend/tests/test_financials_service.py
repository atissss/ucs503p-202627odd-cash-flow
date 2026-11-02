"""Tests for the FMP fetch + transform, with the provider HTTP call mocked."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.financials import service

SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "fmp_aapl.json").read_text())
TEST_KEY = "test-key-not-real"


def _statements(**overrides) -> list[dict]:
    """The three sample records, in `build_assumptions` order, with field overrides."""
    records = [
        dict(SAMPLE["cash-flow-statement"][0]),
        dict(SAMPLE["balance-sheet-statement"][0]),
        dict(SAMPLE["income-statement"][0]),
    ]
    for record in records:
        for field, value in overrides.items():
            if field in record:
                record[field] = value
    return records


def _sample_transport(requests: list[httpx.Request] | None = None) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if requests is not None:
            requests.append(request)
        return httpx.Response(200, json=SAMPLE[request.url.path.rsplit("/", 1)[-1]])

    return httpx.MockTransport(handler)


@pytest.fixture(autouse=True)
def fmp_key(monkeypatch):
    monkeypatch.setattr(settings, "fmp_api_key", TEST_KEY)


def test_fetch_maps_sample_statements_to_assumptions():
    result = service.fetch_assumptions("AAPL", transport=_sample_transport())

    # Reported figures, scaled to millions per the shared contract.
    assert result.base_free_cash_flow == pytest.approx(98_767.0)
    assert result.net_debt == pytest.approx(76_443.0)
    assert result.shares_outstanding == pytest.approx(15_004.697)
    assert result.currency == "USD"
    # Judgment inputs stay at the placeholders, and remain valid together.
    assert result.growth_rate == service.DEFAULT_GROWTH_RATE
    assert result.wacc == service.DEFAULT_WACC
    assert result.terminal_growth == service.DEFAULT_TERMINAL_GROWTH
    assert result.projection_years == service.DEFAULT_PROJECTION_YEARS
    assert result.terminal_growth < result.wacc


def test_fetch_requests_latest_record_of_each_statement():
    requests: list[httpx.Request] = []
    service.fetch_assumptions(" aapl ", transport=_sample_transport(requests))

    assert [r.url.path for r in requests] == [
        "/stable/cash-flow-statement",
        "/stable/balance-sheet-statement",
        "/stable/income-statement",
    ]
    for request in requests:
        assert request.url.host == "financialmodelingprep.com"
        assert request.url.params["symbol"] == "AAPL"
        assert request.url.params["limit"] == "1"
        assert request.url.params["apikey"] == TEST_KEY


@pytest.mark.parametrize("capex", [-12_715_000_000, 12_715_000_000])
def test_capex_is_subtracted_whichever_sign_it_has(capex):
    result = service.build_assumptions(*_statements(capitalExpenditure=capex))
    assert result.base_free_cash_flow == pytest.approx(98_767.0)


def test_empty_response_means_unknown_ticker():
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=[]))
    with pytest.raises(service.TickerNotFoundError):
        service.fetch_assumptions("NOPE", transport=transport)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={"Error Message": "Invalid API KEY."}),
        httpx.Response(402, json={"Error Message": "Not on your plan."}),
        httpx.Response(429, json={"Error Message": "Limit reached."}),
        httpx.Response(500, text="oops"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"Error Message": "Something else."}),
        httpx.Response(200, json=[42]),
    ],
)
def test_bad_provider_responses_raise_provider_error(response):
    transport = httpx.MockTransport(lambda request: response)
    with pytest.raises(service.ProviderError):
        service.fetch_assumptions("AAPL", transport=transport)


@pytest.mark.parametrize(
    "overrides",
    [
        {"operatingCashFlow": None},
        {"totalDebt": "n/a"},
        {"weightedAverageShsOutDil": 0},
        {"reportedCurrency": None},
    ],
)
def test_unusable_figures_raise_provider_error(overrides):
    with pytest.raises(service.ProviderError):
        service.build_assumptions(*_statements(**overrides))


def test_missing_key_raises_provider_error_without_calling_provider(monkeypatch):
    monkeypatch.setattr(settings, "fmp_api_key", "")
    requests: list[httpx.Request] = []
    with pytest.raises(service.ProviderError):
        service.fetch_assumptions("AAPL", transport=_sample_transport(requests))
    assert requests == []


def test_network_failure_does_not_leak_key(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot connect to {request.url}")

    with caplog.at_level(logging.DEBUG), pytest.raises(service.ProviderError) as excinfo:
        service.fetch_assumptions("AAPL", transport=httpx.MockTransport(handler))

    assert TEST_KEY not in str(excinfo.value)
    assert excinfo.value.__suppress_context__
    assert TEST_KEY not in caplog.text


def test_successful_fetch_does_not_log_key(caplog):
    with caplog.at_level(logging.INFO):
        service.fetch_assumptions("AAPL", transport=_sample_transport())
    assert TEST_KEY not in caplog.text
