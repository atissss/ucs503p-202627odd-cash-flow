"""Unit tests for the scenario repository (DB logic, no HTTP)."""

from __future__ import annotations

import pytest

from app import repository
from app.models import ScenarioCreate, ScenarioUpdate

from .conftest import DEFAULT_USER_ID, OTHER_USER_ID, valid_scenario_body


def _create(**overrides) -> ScenarioCreate:
    return ScenarioCreate.model_validate(valid_scenario_body(**overrides))


def test_create_assigns_id_and_timestamps(session):
    row = repository.create_scenario(
        session, owner_id=DEFAULT_USER_ID, payload=_create()
    )
    assert row.id
    assert row.owner_id == DEFAULT_USER_ID
    assert row.created_at is not None
    assert row.updated_at is not None
    # Nested objects persist as dicts.
    assert row.assumptions["wacc"] == 0.09


def test_get_returns_only_owned(session):
    row = repository.create_scenario(
        session, owner_id=DEFAULT_USER_ID, payload=_create()
    )
    assert repository.get_scenario(
        session, owner_id=DEFAULT_USER_ID, scenario_id=row.id
    ) is not None
    # A different owner cannot fetch it.
    assert repository.get_scenario(
        session, owner_id=OTHER_USER_ID, scenario_id=row.id
    ) is None


def test_list_is_scoped_to_owner(session):
    repository.create_scenario(session, owner_id=DEFAULT_USER_ID, payload=_create())
    repository.create_scenario(session, owner_id=DEFAULT_USER_ID, payload=_create())
    repository.create_scenario(session, owner_id=OTHER_USER_ID, payload=_create())

    mine = repository.list_scenarios(session, owner_id=DEFAULT_USER_ID)
    theirs = repository.list_scenarios(session, owner_id=OTHER_USER_ID)
    assert len(mine) == 2
    assert len(theirs) == 1
    assert all(r.owner_id == DEFAULT_USER_ID for r in mine)


def test_update_changes_fields_and_bumps_updated_at(session):
    row = repository.create_scenario(
        session, owner_id=DEFAULT_USER_ID, payload=_create()
    )
    original_updated = row.updated_at

    payload = ScenarioUpdate.model_validate(
        valid_scenario_body(name="Renamed", kind="bull")
    )
    updated = repository.update_scenario(
        session, owner_id=DEFAULT_USER_ID, scenario_id=row.id, payload=payload
    )
    assert updated is not None
    assert updated.name == "Renamed"
    assert updated.kind == "bull"
    assert updated.updated_at >= original_updated


def test_update_of_unowned_returns_none(session):
    row = repository.create_scenario(
        session, owner_id=DEFAULT_USER_ID, payload=_create()
    )
    payload = ScenarioUpdate.model_validate(valid_scenario_body(name="Hijack"))
    assert repository.update_scenario(
        session, owner_id=OTHER_USER_ID, scenario_id=row.id, payload=payload
    ) is None


def test_delete_only_owner(session):
    row = repository.create_scenario(
        session, owner_id=DEFAULT_USER_ID, payload=_create()
    )
    # Wrong owner can't delete.
    assert repository.delete_scenario(
        session, owner_id=OTHER_USER_ID, scenario_id=row.id
    ) is False
    # Owner can, and a second delete is a no-op.
    assert repository.delete_scenario(
        session, owner_id=DEFAULT_USER_ID, scenario_id=row.id
    ) is True
    assert repository.delete_scenario(
        session, owner_id=DEFAULT_USER_ID, scenario_id=row.id
    ) is False


def test_guardrail_rejects_terminal_growth_ge_wacc():
    # terminal_growth == wacc and > wacc both rejected at model validation.
    with pytest.raises(ValueError):
        _create(
            assumptions={
                "base_free_cash_flow": 1000.0,
                "growth_rate": 0.08,
                "wacc": 0.09,
                "terminal_growth": 0.09,
                "projection_years": 5,
                "net_debt": 0.0,
                "shares_outstanding": 1000.0,
                "currency": "USD",
            }
        )
