"""Shared pytest fixtures — an isolated in-memory database per test.

Overriding `get_session` with a StaticPool in-memory engine keeps every test
hermetic and never touches the real SQLite file. TestClient is used without a
context manager so the app lifespan (which would create the real DB) stays off.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.tables import User  # noqa: F401  (import registers the table on metadata)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def _override_get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    yield TestClient(app)
    app.dependency_overrides.clear()
