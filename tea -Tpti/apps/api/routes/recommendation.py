"""Recommendation 路由：按 Taste Vector 返回 Top 推荐。

GET /api/recommendation?user_id=...
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from schemas import RecommendationOut, tea_out_from_model
from services import recommendation, tea_profile

router = APIRouter(prefix="/api", tags=["recommendation"])


@router.get("/recommendation", response_model=RecommendationOut)
def get_recommendation(user_id: str, db: Session = Depends(get_db)):
    profile = recommendation.get_taste_profile(db, user_id)
    tea_ids = recommendation.recommend(db, user_id, top_k=3)

    teas = []
    for tea_id in tea_ids:
        tea = tea_profile.get_tea(db, tea_id)
        if tea is not None:
            teas.append(tea_out_from_model(tea))

    return RecommendationOut(
        user_id=user_id,
        teas=teas,
        confidence_state=profile["confidence_state"],
        exploration_bonus=recommendation.exploration_bonus(profile["sample_count"]),
    )
