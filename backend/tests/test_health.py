"""Smoke tests for the Week 1 skeleton — enough to keep CI meaningful."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "intrinsic-api"


def test_api_health_alias():
    assert client.get("/api/health").status_code == 200
