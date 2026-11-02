"""Endpoint tests for GET /api/financials/{ticker}, with the service mocked."""

from __future__ import annotations

from app.financials import service
from app.models import Assumptions

SAMPLE_ASSUMPTIONS = Assumptions(
    base_free_cash_flow=98_767.0,
    growth_rate=0.08,
    wacc=0.09,
    terminal_growth=0.025,
    projection_years=5,
    net_debt=76_443.0,
    shares_outstanding=15_004.697,
    currency="USD",
)


def _raises(exc: Exception):
    def fake_fetch(ticker: str):
        raise exc

    return fake_fetch


def test_returns_populated_assumptions(client, monkeypatch):
    seen: list[str] = []

    def fake_fetch(ticker: str) -> Assumptions:
        seen.append(ticker)
        return SAMPLE_ASSUMPTIONS

    monkeypatch.setattr(service, "fetch_assumptions", fake_fetch)

    res = client.get("/api/financials/AAPL")

    assert res.status_code == 200, res.text
    assert res.json() == SAMPLE_ASSUMPTIONS.model_dump()
    assert seen == ["AAPL"]


def test_unknown_ticker_returns_404(client, monkeypatch):
    monkeypatch.setattr(
        service, "fetch_assumptions", _raises(service.TickerNotFoundError("NOPE"))
    )

    res = client.get("/api/financials/NOPE")

    assert res.status_code == 404
    assert res.json() == {"error": {"code": "http_error", "message": "Ticker not found"}}


def test_provider_failure_returns_502(client, monkeypatch):
    monkeypatch.setattr(
        service, "fetch_assumptions", _raises(service.ProviderError("Provider is down"))
    )

    res = client.get("/api/financials/AAPL")

    assert res.status_code == 502
    assert res.json() == {"error": {"code": "http_error", "message": "Provider is down"}}


def test_requires_authentication(auth_client, monkeypatch):
    monkeypatch.setattr(service, "fetch_assumptions", _raises(AssertionError("not reached")))

    assert auth_client.get("/api/financials/AAPL").status_code == 401
