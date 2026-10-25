"""Database engine and session management (SQLite via SQLModel).

This is the shared "Step 0" foundation both backend slices build on:
`get_session` is the FastAPI dependency used by every endpoint that touches the
database, and `init_db` creates the tables on startup.
"""

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import settings

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)


def init_db() -> None:
    """Create tables for every registered SQLModel table model."""
    # Import for the side effect of registering tables on SQLModel.metadata:
    # `tables` holds User, `orm` holds ScenarioTable.
    from . import orm, tables  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
