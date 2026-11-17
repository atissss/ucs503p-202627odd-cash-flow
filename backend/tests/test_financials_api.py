"""Endpoint tests for GET /api/financials/{ticker}, with the provider HTTP call mocked."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.financials import client as fmp_client
from app.financials import service

SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "fmp_aapl.json").read_text())


def _sample_handler(request: httpx.Request, **overrides) -> httpx.Response:
    rows = SAMPLE[request.url.path.rsplit("/", 1)[-1]]
    return httpx.Response(200, json=[{**rows[0], **overrides}])


class Provider:
    """A mock FMP: counts calls and answers with `handler`."""

    def __init__(self) -> None:
        self.calls = 0
        self.handler = _sample_handler

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        return self.handler(request)

    def respond(self, response: httpx.Response) -> None:
        self.handler = lambda request: response


@pytest.fixture(autouse=True)
def provider(monkeypatch) -> Provider:
    fake = Provider()
    monkeypatch.setattr(settings, "fmp_api_key", "test-key-not-real")
    monkeypatch.setattr(fmp_client, "transport", httpx.MockTransport(fake))
    service.clear_cache()
    yield fake
    service.clear_cache()


def test_returns_populated_assumptions(client):
    res = client.get("/api/financials/aapl")

    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"ticker", "data_status", "as_of", "fetched_at", "assumptions", "warnings"}
    assert body["ticker"] == "AAPL"
    assert body["data_status"] == "fetched"
    assert body["as_of"] == "2025-09-27"
    assert body["assumptions"] == {
        "base_free_cash_flow": pytest.approx(98_767.0),
        "growth_rate": service.DEFAULT_GROWTH_RATE,
        "wacc": service.DEFAULT_WACC,
        "terminal_growth": service.DEFAULT_TERMINAL_GROWTH,
        "projection_years": service.DEFAULT_PROJECTION_YEARS,
        "net_debt": pytest.approx(76_443.0),
        "shares_outstanding": pytest.approx(15_004.697),
        "currency": "USD",
    }


def test_second_lookup_is_cached(client, provider):
    client.get("/api/financials/AAPL")
    res = client.get("/api/financials/AAPL")

    assert res.json()["data_status"] == "cached"
    assert provider.calls == 3


def test_warnings_are_returned_with_the_data(client, provider):
    provider.handler = lambda request: _sample_handler(request, capitalExpenditure=0)

    res = client.get("/api/financials/AAPL")

    assert res.status_code == 200
    [warning] = res.json()["warnings"]
    assert (warning["field"], warning["code"]) == ("base_free_cash_flow", "zero_capex")
    assert warning["message"]


@pytest.mark.parametrize(
    ("response", "status", "code"),
    [
        (httpx.Response(200, json=[]), 404, "ticker_not_found"),
        (httpx.Response(402, json={}), 404, "ticker_not_covered"),
        (httpx.Response(500, text="oops"), 502, "provider_error"),
        (httpx.Response(200, text="not json"), 502, "provider_error"),
        (httpx.Response(200, json=[{"symbol": "AAPL"}]), 502, "invalid_data"),
        (httpx.Response(429, json={}), 503, "rate_limited"),
    ],
)
def test_provider_failures_return_clean_errors(client, provider, response, status, code):
    provider.respond(response)

    res = client.get("/api/financials/AAPL")

    assert res.status_code == status
    assert res.json()["error"]["code"] == code
    assert isinstance(res.json()["error"]["message"], str)


def test_rate_limited_sets_retry_after(client, provider):
    provider.respond(httpx.Response(429, json={}))

    res = client.get("/api/financials/AAPL")

    assert res.headers["Retry-After"] == str(settings.fmp_rate_limit_cooldown_seconds)


def test_network_failure_returns_502(client, provider):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timed out")

    provider.handler = handler

    res = client.get("/api/financials/AAPL")

    assert res.status_code == 502
    assert res.json()["error"]["code"] == "provider_error"


def test_malformed_ticker_returns_422_without_calling_provider(client, provider):
    res = client.get("/api/financials/AA%20PL")

    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_ticker"
    assert provider.calls == 0


def test_missing_key_returns_503(client, monkeypatch):
    monkeypatch.setattr(settings, "fmp_api_key", "")

    res = client.get("/api/financials/AAPL")

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "provider_not_configured"


def test_requires_authentication(auth_client, provider):
    assert auth_client.get("/api/financials/AAPL").status_code == 401
    assert provider.calls == 0
