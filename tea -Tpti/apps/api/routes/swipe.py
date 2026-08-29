"""Swipe 路由：记录一次 like / skip / save，并更新 Taste Vector。

POST /api/swipe {user_id, tea_id, action}
返回 taste_profile_delta / next_tea / recommendation_ready。
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import SENSORY_DIMS, SwipeEvent
from schemas import SwipeIn, SwipeOut, TasteProfileDelta, tea_out_from_model
from services import recommendation, tea_profile

router = APIRouter(prefix="/api", tags=["swipe"])

# 累计信号达到该阈值后，个性化推荐视为「可用」
RECOMMENDATION_READY_THRESHOLD = 3


@router.post("/swipe", response_model=SwipeOut)
def swipe(payload: SwipeIn, db: Session = Depends(get_db)):
    # 1. 记录 swipe 事件（供 seen / Tea-BTI evidence 读取）
    db.add(
        SwipeEvent(
            user_id=payload.user_id,
            tea_id=payload.tea_id,
            action=payload.action,
            timestamp=datetime.now().isoformat(),
        )
    )
    db.commit()

    # 2. 更新 Taste Vector
    updated = recommendation.update_taste_profile(
        db, payload.user_id, payload.action, payload.tea_id
    )

    # 3. 下一杯（当前用户还没刷过的最匹配一杯）
    next_tea = None
    next_ids = recommendation.recommend(db, payload.user_id, top_k=1)
    if next_ids:
        tea = tea_profile.get_tea(db, next_ids[0])
        if tea is not None:
            next_tea = tea_out_from_model(tea)

    delta = TasteProfileDelta(
        **{dim: round(updated.get(dim, 0.0), 4) for dim in SENSORY_DIMS}
    )
    ready = updated["sample_count"] >= RECOMMENDATION_READY_THRESHOLD

    return SwipeOut(
        taste_profile_delta=delta,
        next_tea=next_tea,
        recommendation_ready=ready,
    )
