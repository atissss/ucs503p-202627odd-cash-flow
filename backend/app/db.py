"""Database engine, session dependency and table creation.

A thin SQLModel/SQLite layer shared by the whole backend. Route handlers get a
session via the `get_session` FastAPI dependency; tests override that
dependency to point at a throwaway database (see `tests/conftest.py`).
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

# `check_same_thread=False` is required for SQLite under FastAPI's threadpool;
# it is safe because each request gets its own short-lived session.
_settings = get_settings()
engine: Engine = create_engine(
    _settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False}
    if _settings.database_url.startswith("sqlite")
    else {},
)


def create_db_and_tables(bind: Engine | None = None) -> None:
    """Create any tables that don't exist yet.

    Importing the ORM models registers them on `SQLModel.metadata`, so this must
    run after they are imported. Called on app startup.
    """
    # Ensure the ORM models are imported so their tables are registered.
    from . import orm  # noqa: F401

    SQLModel.metadata.create_all(bind or engine)


def get_session() -> Iterator[Session]:
    """Yield a database session, closing it when the request finishes."""
    with Session(engine) as session:
        yield session
