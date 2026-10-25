"""Endpoint tests for the scenario CRUD API."""

from __future__ import annotations

from .conftest import DEFAULT_USER_ID, OTHER_USER_ID, valid_scenario_body


def test_crud_round_trip(client):
    # CREATE
    res = client.post("/api/scenarios", json=valid_scenario_body())
    assert res.status_code == 201, res.text
    created = res.json()
    scenario_id = created["id"]
    assert created["name"] == "AAPL — Base case"
    assert created["assumptions"]["wacc"] == 0.09
    assert created["created_at"] and created["updated_at"]

    # READ one
    res = client.get(f"/api/scenarios/{scenario_id}")
    assert res.status_code == 200
    assert res.json()["id"] == scenario_id

    # LIST
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    listed = res.json()
    assert len(listed) == 1
    assert listed[0]["id"] == scenario_id

    # UPDATE
    res = client.put(
        f"/api/scenarios/{scenario_id}",
        json=valid_scenario_body(name="AAPL — Bull case", kind="bull"),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "AAPL — Bull case"
    assert res.json()["kind"] == "bull"

    # DELETE
    res = client.delete(f"/api/scenarios/{scenario_id}")
    assert res.status_code == 204

    # Gone afterwards.
    assert client.get(f"/api/scenarios/{scenario_id}").status_code == 404
    assert client.get("/api/scenarios").json() == []


def test_read_missing_returns_404(client):
    assert client.get("/api/scenarios/does-not-exist").status_code == 404


def test_guardrail_returns_422(client):
    body = valid_scenario_body()
    body["assumptions"]["terminal_growth"] = 0.12  # >= wacc (0.09)
    res = client.post("/api/scenarios", json=body)
    assert res.status_code == 422


def test_invalid_enum_returns_422(client):
    body = valid_scenario_body(kind="mega-bull")
    assert client.post("/api/scenarios", json=body).status_code == 422


def test_user_cannot_read_or_modify_another_users_scenario(client):
    # User A creates a scenario.
    client.acting_user_id = DEFAULT_USER_ID
    res = client.post("/api/scenarios", json=valid_scenario_body())
    assert res.status_code == 201
    scenario_id = res.json()["id"]

    # User B cannot see it in any way.
    client.acting_user_id = OTHER_USER_ID
    assert client.get(f"/api/scenarios/{scenario_id}").status_code == 404
    assert client.get("/api/scenarios").json() == []
    assert client.put(
        f"/api/scenarios/{scenario_id}", json=valid_scenario_body(name="Stolen")
    ).status_code == 404
    assert client.delete(f"/api/scenarios/{scenario_id}").status_code == 404

    # User A's scenario is untouched.
    client.acting_user_id = DEFAULT_USER_ID
    assert client.get(f"/api/scenarios/{scenario_id}").json()["name"] == "AAPL — Base case"


def test_stored_valuation_round_trips(client):
    valuation = {
        "status": "ok",
        "projection": [
            {
                "year": 1,
                "free_cash_flow": 1080.0,
                "discount_factor": 0.9174,
                "present_value": 990.8,
            }
        ],
        "pv_of_projection": 990.8,
        "terminal_value": 20000.0,
        "pv_of_terminal_value": 13000.0,
        "enterprise_value": 13990.8,
        "equity_value": 13990.8,
        "intrinsic_value_per_share": 13.99,
    }
    res = client.post("/api/scenarios", json=valid_scenario_body(valuation=valuation))
    assert res.status_code == 201
    got = res.json()["valuation"]
    assert got["status"] == "ok"
    assert got["intrinsic_value_per_share"] == 13.99
    assert got["projection"][0]["year"] == 1
