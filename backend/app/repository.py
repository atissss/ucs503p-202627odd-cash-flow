"""Scenario persistence — data access separated from the route handlers.

Every function is scoped by `owner_id` so a user can only ever touch their own
scenarios; the routers pass the id from the authenticated user. Functions take
a `Session` and return `ScenarioTable` rows (or `None`); HTTP concerns (status
codes, response models) live in the router.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from .models import ScenarioCreate, ScenarioUpdate
from .orm import ScenarioTable


def _utcnow() -> datetime:
    return datetime.now(UTC)


def create_scenario(
    session: Session, *, owner_id: str, payload: ScenarioCreate
) -> ScenarioTable:
    """Persist a new scenario owned by `owner_id` and return it."""
    now = _utcnow()
    row = ScenarioTable(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        name=payload.name,
        kind=payload.kind,
        data_status=payload.data_status,
        ticker=payload.ticker,
        assumptions=payload.assumptions.model_dump(),
        valuation=payload.valuation.model_dump() if payload.valuation else None,
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_scenario(
    session: Session, *, owner_id: str, scenario_id: str
) -> ScenarioTable | None:
    """Return the scenario if it exists AND belongs to `owner_id`, else None."""
    row = session.get(ScenarioTable, scenario_id)
    if row is None or row.owner_id != owner_id:
        return None
    return row


def list_scenarios(session: Session, *, owner_id: str) -> list[ScenarioTable]:
    """Return all scenarios owned by `owner_id`, newest first."""
    statement = (
        select(ScenarioTable)
        .where(ScenarioTable.owner_id == owner_id)
        .order_by(ScenarioTable.created_at.desc())
    )
    return list(session.exec(statement))


def update_scenario(
    session: Session, *, owner_id: str, scenario_id: str, payload: ScenarioUpdate
) -> ScenarioTable | None:
    """Replace an owned scenario's editable fields. None if missing/not-owned."""
    row = get_scenario(session, owner_id=owner_id, scenario_id=scenario_id)
    if row is None:
        return None

    row.name = payload.name
    row.kind = payload.kind
    row.data_status = payload.data_status
    row.ticker = payload.ticker
    row.assumptions = payload.assumptions.model_dump()
    row.valuation = payload.valuation.model_dump() if payload.valuation else None
    row.updated_at = _utcnow()

    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def delete_scenario(
    session: Session, *, owner_id: str, scenario_id: str
) -> bool:
    """Delete an owned scenario. Return True if deleted, False if missing/not-owned."""
    row = get_scenario(session, owner_id=owner_id, scenario_id=scenario_id)
    if row is None:
        return False
    session.delete(row)
    session.commit()
    return True
