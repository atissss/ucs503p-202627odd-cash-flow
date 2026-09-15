"""Scenario CRUD endpoints, all scoped to the authenticated user.

The handlers stay thin: authenticate (via `get_current_user`), delegate to the
repository, and translate a missing/not-owned row into a 404. Payload
validation — including the `terminal_growth < wacc` guardrail — happens in the
`ScenarioCreate` / `ScenarioUpdate` models, so invalid bodies return 422 before
a handler runs.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from .. import repository
from ..auth import CurrentUser, get_current_user
from ..db import get_session
from ..models import Scenario, ScenarioCreate, ScenarioUpdate
from ..orm import ScenarioTable

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

# Reusable dependency annotations (the Annotated form keeps the call out of the
# argument defaults, which flake8-bugbear/B008 flags).
SessionDep = Annotated[Session, Depends(get_session)]
UserDep = Annotated[CurrentUser, Depends(get_current_user)]


def _to_response(row: ScenarioTable) -> Scenario:
    """Map a persisted row to the shared `Scenario` response contract."""
    return Scenario.model_validate(row, from_attributes=True)


def _not_found() -> HTTPException:
    # Same 404 for "does not exist" and "not yours" — never leak the existence
    # of another user's scenario.
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")


@router.post("", response_model=Scenario, status_code=status.HTTP_201_CREATED)
def create_scenario(
    payload: ScenarioCreate, session: SessionDep, user: UserDep
) -> Scenario:
    row = repository.create_scenario(session, owner_id=user.id, payload=payload)
    return _to_response(row)


@router.get("", response_model=list[Scenario])
def list_scenarios(session: SessionDep, user: UserDep) -> list[Scenario]:
    rows = repository.list_scenarios(session, owner_id=user.id)
    return [_to_response(row) for row in rows]


@router.get("/{scenario_id}", response_model=Scenario)
def read_scenario(scenario_id: str, session: SessionDep, user: UserDep) -> Scenario:
    row = repository.get_scenario(session, owner_id=user.id, scenario_id=scenario_id)
    if row is None:
        raise _not_found()
    return _to_response(row)


@router.put("/{scenario_id}", response_model=Scenario)
def update_scenario(
    scenario_id: str, payload: ScenarioUpdate, session: SessionDep, user: UserDep
) -> Scenario:
    row = repository.update_scenario(
        session, owner_id=user.id, scenario_id=scenario_id, payload=payload
    )
    if row is None:
        raise _not_found()
    return _to_response(row)


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(
    scenario_id: str, session: SessionDep, user: UserDep
) -> Response:
    deleted = repository.delete_scenario(
        session, owner_id=user.id, scenario_id=scenario_id
    )
    if not deleted:
        raise _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
