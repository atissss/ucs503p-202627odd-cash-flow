"""SQLModel ORM tables — the persistent schema.

Person 2 owns `User`; `Scenario` stores a saved valuation (its assumptions and
computed valuation are kept as JSON so the frontend's shape round-trips as-is).
For the demo, scenarios are not scoped to a user (open, no login).
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return uuid4().hex


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utcnow)


class Scenario(SQLModel, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    name: str
    kind: str = "custom"
    data_status: str = "manual"
    ticker: str | None = None
    assumptions: dict = Field(sa_column=Column(JSON))
    valuation: dict | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
