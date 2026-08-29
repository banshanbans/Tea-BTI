"""Taste Mode 归一化路由：把「普通人的话」翻译成「茶专业语言」。

POST /api/taste/normalize {user_words}
"""

from fastapi import APIRouter

from schemas import TasteNormalizeIn, TasteNormalizeOut
from services import tasting

router = APIRouter(prefix="/api/taste", tags=["taste"])


@router.post("/normalize", response_model=TasteNormalizeOut)
def normalize(payload: TasteNormalizeIn):
    result = tasting.normalize(payload.user_words, tea_id=payload.tea_id)
    return TasteNormalizeOut(
        user_words=result["user_words"],
        normalized=result["normalized"],
        explanation=result["explanation"],
    )
