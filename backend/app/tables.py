"""SQLModel ORM tables — the User account table.

Person 2 owns `User`; the `Scenario` table lives in `orm.py` (Person 1).
`User.id` is a string UUID so it lines up with `ScenarioTable.owner_id`.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return uuid4().hex


class User(SQLModel, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utcnow)
