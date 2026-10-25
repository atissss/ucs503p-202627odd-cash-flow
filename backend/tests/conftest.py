"""Shared pytest fixtures for the backend test-suite.

Each test gets a fresh in-memory SQLite database (`StaticPool`, so every session
shares the one connection), with `get_session` overridden so tests never touch
the real `intrinsic.db`. Two client fixtures:

- `client`      — also overrides `get_current_user` with a controllable stub
                  user (`acting_user_id`), for the scenario-CRUD tests.
- `auth_client` — leaves the real auth dependency in place, for the auth tests
                  that exercise register / login / token flows.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import orm  # noqa: F401  -- registers the scenario table on the metadata
from app.auth import CurrentUser, get_current_user
from app.db import get_session
from app.main import app

# Acting users for tests that exercise per-user ownership isolation.
DEFAULT_USER_ID = "user-aaaa"
OTHER_USER_ID = "user-bbbb"


def valid_scenario_body(**overrides) -> dict:
    """A well-formed create/update JSON body (snake_case, matching the models)."""
    body = {
        "name": "AAPL — Base case",
        "kind": "base",
        "data_status": "manual",
        "ticker": "AAPL",
        "assumptions": {
            "base_free_cash_flow": 1000.0,
            "growth_rate": 0.08,
            "wacc": 0.09,
            "terminal_growth": 0.025,
            "projection_years": 5,
            "net_debt": 0.0,
            "shares_outstanding": 1000.0,
            "currency": "USD",
        },
        "valuation": None,
    }
    body.update(overrides)
    return body


@pytest.fixture
def engine():
    """A fresh in-memory database with all tables (User + Scenario) created."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


@pytest.fixture
def session(engine) -> Iterator[Session]:
    """A session bound to the throwaway database, for repository unit tests."""
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine) -> Iterator[TestClient]:
    """TestClient wired to the throwaway DB with a stub acting user.

    Switch the acting user with `client.acting_user_id = OTHER_USER_ID`.
    """

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as s:
            yield s

    def override_get_current_user() -> CurrentUser:
        return CurrentUser(id=test_client.acting_user_id)

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user

    test_client = TestClient(app)
    test_client.acting_user_id = DEFAULT_USER_ID  # type: ignore[attr-defined]
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def auth_client(engine) -> Iterator[TestClient]:
    """TestClient wired to the throwaway DB, using the REAL auth dependency."""

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override_get_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
