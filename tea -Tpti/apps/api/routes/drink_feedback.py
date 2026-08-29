"""真喝反馈路由：记录 DrinkFeedback + 高权重更新 Taste Vector。

POST /api/drink-feedback {user_id, tea_id, result, user_words, infusion_number}
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from schemas import DrinkFeedbackIn, DrinkFeedbackOut
from services import memory, recommendation

router = APIRouter(prefix="/api", tags=["drink-feedback"])

# result -> 高权重信号动作（技术架构 8.3：真喝反馈权重大于 swipe）
ACTION_MAP = {
    "like": "drink_like",
    "neutral": "drink_neutral",
    "dislike": "drink_dislike",
}


@router.post("/drink-feedback", response_model=DrinkFeedbackOut)
def drink_feedback(payload: DrinkFeedbackIn, db: Session = Depends(get_db)):
    # 1. 记录真喝反馈（user_words 未给 normalized_tags 时用规则版归一化补齐）
    feedback = memory.record_drink_feedback(
        db,
        payload.user_id,
        payload.tea_id,
        payload.result,
        user_words=payload.user_words,
        normalized_tags=payload.normalized_tags,
        infusion_number=payload.infusion_number,
    )

    # 2. 高权重更新 Taste Vector
    recommendation.update_taste_profile(
        db, payload.user_id, ACTION_MAP[payload.result], payload.tea_id
    )

    # 3. 真喝 -> 标记「已品过」
    memory.mark_tasted(db, payload.user_id, payload.tea_id)

    return DrinkFeedbackOut(
        id=feedback.id,
        user_id=feedback.user_id,
        tea_id=feedback.tea_id,
        result=feedback.result,
        user_words=feedback.user_words,
        normalized_tags=feedback.normalized_tags,
        infusion_number=feedback.infusion_number,
        timestamp=feedback.timestamp,
    )
