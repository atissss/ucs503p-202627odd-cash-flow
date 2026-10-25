"""SQLModel ORM tables.

The scenario table mirrors the shared `Scenario` contract. The nested
`assumptions` and `valuation` objects are stored as JSON columns rather than
exploded into their own tables: they are always read and written as a whole,
never queried field-by-field, so JSON keeps the round-trip lossless and the
schema small.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ScenarioTable(SQLModel, table=True):
    """Persisted scenario. See `frontend/src/domain/scenario.ts` for the contract."""

    __tablename__ = "scenario"

    id: str = Field(primary_key=True)

    # Logical foreign key to the user who owns this scenario. Indexed so the
    # per-user list query stays cheap.
    # TODO: promote to a DB-level ForeignKey("user.id") once Person 2's `User`
    # table is registered on the shared SQLModel metadata.
    owner_id: str = Field(index=True)

    name: str
    # Stored as plain strings; the enum is enforced by the request models
    # (ScenarioKind / DataStatus in models.py) before anything reaches the DB.
    kind: str
    data_status: str
    ticker: str | None = Field(default=None)

    # Nested contract objects, stored whole as JSON.
    assumptions: dict = Field(sa_column=Column(JSON))
    valuation: dict | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
