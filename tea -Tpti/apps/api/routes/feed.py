"""Feed 路由：冷启动（多样性优先）或个性化 Feed。

GET /api/feed?user_id=...
- 无任何信号（sample_count == 0）时走 cold_start_feed；
- 否则走 recommend（按 Taste Vector 排序）。
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from schemas import tea_out_from_model
from services import recommendation, tea_profile

router = APIRouter(prefix="/api", tags=["feed"])


@router.get("/feed")
def get_feed(user_id: str, db: Session = Depends(get_db)):
    profile = recommendation.get_taste_profile(db, user_id)

    if profile["sample_count"] <= 0:
        mode = "cold_start"
        tea_ids = recommendation.cold_start_feed(db, count=5)
    else:
        mode = "personalized"
        tea_ids = recommendation.recommend(db, user_id, top_k=5)

    teas = []
    for tea_id in tea_ids:
        tea = tea_profile.get_tea(db, tea_id)
        if tea is not None:
            teas.append(tea_out_from_model(tea))

    return {
        "user_id": user_id,
        "mode": mode,
        "confidence_state": profile["confidence_state"],
        "teas": teas,
    }
