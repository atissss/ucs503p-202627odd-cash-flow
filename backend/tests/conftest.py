"""Shared pytest fixtures: a throwaway database and a test client.

Each test gets a fresh in-memory SQLite database (via `StaticPool`, so every
session in the test shares the one connection). The `client` fixture overrides
the app's `get_session` and `get_current_user` dependencies to point at that
database and a controllable acting user, so tests never touch the real
`intrinsic.db` file.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import orm  # noqa: F401  -- registers tables on SQLModel.metadata
from app.auth import CurrentUser, get_current_user
from app.db import get_session
from app.main import app

# A default acting user for tests that don't care about identity.
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
    """A fresh in-memory database with all tables created."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def session(engine) -> Iterator[Session]:
    """A session bound to the throwaway database, for repository unit tests."""
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine) -> Iterator[TestClient]:
    """A TestClient wired to the throwaway database.

    The acting user defaults to `DEFAULT_USER_ID`; a test can switch users with
    `client.acting_user_id = OTHER_USER_ID` to exercise ownership isolation.
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
