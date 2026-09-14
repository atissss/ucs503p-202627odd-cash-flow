"""SQLModel ORM tables — the persistent schema.

Person 2 owns `User`; Person 1 adds the `Scenario` table here (with an
`owner_id` foreign key to `user.id`).
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utcnow)
