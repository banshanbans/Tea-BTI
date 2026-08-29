"""Brew Vision 帧分析路由（demo 阶段走 mock 降级）。

POST /api/brew/frame {frame, step_hint}
"""

from fastapi import APIRouter

from schemas import BrewFrameIn, BrewFrameOut
from services import brew_vision

router = APIRouter(prefix="/api/brew", tags=["brew"])


@router.post("/frame", response_model=BrewFrameOut)
def analyze_frame(payload: BrewFrameIn):
    frame_input = payload.frame or payload.frame_b64
    result = brew_vision.analyze_frame(
        frame_input=frame_input,
        step_hint=payload.step_hint,
    )
    return BrewFrameOut(
        state=result["state"],
        confidence=result["confidence"],
        message=result["message"],
        observations=result["observations"],
        uncertain=result["uncertain"],
        suggestion=result.get("suggestion", ""),
    )
