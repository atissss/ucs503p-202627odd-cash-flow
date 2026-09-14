"""Scenario CRUD endpoints.

Open (no auth) for the demo. Responses use camelCase keys so they match the
frontend's `Scenario` type in `frontend/src/domain/scenario.ts` directly; the
`assumptions`/`valuation` blobs are stored and returned verbatim.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..tables import Scenario

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


class ScenarioCreate(BaseModel):
    name: str
    kind: str = "custom"
    dataStatus: str = "manual"
    ticker: str | None = None
    assumptions: dict
    valuation: dict | None = None


def _serialize(s: Scenario) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "kind": s.kind,
        "dataStatus": s.data_status,
        "ticker": s.ticker,
        "assumptions": s.assumptions,
        "valuation": s.valuation,
        "createdAt": s.created_at.isoformat(),
        "updatedAt": s.updated_at.isoformat(),
    }


@router.get("")
def list_scenarios(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.exec(select(Scenario).order_by(Scenario.created_at)).all()
    return [_serialize(s) for s in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_scenario(payload: ScenarioCreate, session: Session = Depends(get_session)) -> dict:
    now = datetime.now(UTC)
    scenario = Scenario(
        name=payload.name,
        kind=payload.kind,
        data_status=payload.dataStatus,
        ticker=payload.ticker,
        assumptions=payload.assumptions,
        valuation=payload.valuation,
        created_at=now,
        updated_at=now,
    )
    session.add(scenario)
    session.commit()
    session.refresh(scenario)
    return _serialize(scenario)


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(scenario_id: str, session: Session = Depends(get_session)) -> None:
    scenario = session.get(Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    session.delete(scenario)
    session.commit()
