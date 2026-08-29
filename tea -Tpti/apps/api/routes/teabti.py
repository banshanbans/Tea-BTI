"""Tea-BTI 路由：把 Taste Vector 投影成「味觉人格」。

GET /api/teabti?user_id=...
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from schemas import TeaBtiAxes, TeaBtiOut
from services import teabti

router = APIRouter(prefix="/api", tags=["teabti"])


@router.get("/teabti", response_model=TeaBtiOut)
def get_teabti(user_id: str, db: Session = Depends(get_db)):
    result = teabti.build_teabti(db, user_id)
    return TeaBtiOut(
        user_id=result["user_id"],
        axes=TeaBtiAxes(**result["axes"]),
        archetype=result["archetype"],
        archetype_name=result["archetype_name"],
        confidence_state=result["confidence_state"],
        confidence_label=result.get("confidence_label", ""),
        explanation=result["explanation"],
        evidence=result.get("evidence", []),
    )
