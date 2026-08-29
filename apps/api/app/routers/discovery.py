from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from ..catalog import catalog
from ..config import get_settings
from ..deps import ApiError, CurrentUser, Db, capabilities_payload
from ..schemas import (
    BootstrapResponse, CapabilitiesResponse, FeedResponse, SeedBatchResponse, SeedRequest,
    SwipeRequest, SwipeResponse, TeaDetailResponse,
)
from ..taste import get_or_create_profile, profile_response, recommendation, record_swipe, swipe_count, tea_journey

settings = get_settings()
router = APIRouter()


@router.get(settings.api_prefix + "/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    return capabilities_payload()


@router.get(settings.api_prefix + "/bootstrap", response_model=BootstrapResponse)
def bootstrap(user: CurrentUser, db: Db):
    count = swipe_count(db, user.id)
    profile = get_or_create_profile(db, user.id)
    return {
        "userId": user.id,
        "mbti": user.mbti,
        "onboardingCompleted": user.onboarding_completed,
        "swipeCount": count,
        "recommendationReady": count >= 5,
        "tasteProfile": profile_response(profile),
        "capabilities": capabilities_payload(),
    }


@router.post(settings.api_prefix + "/onboarding/seed", response_model=SeedBatchResponse)
def onboarding_seed(payload: SeedRequest, user: CurrentUser, db: Db):
    user.mbti = payload.mbti.value if payload.mbti else None
    user.onboarding_completed = True
    db.commit()
    return {"mbti": payload.mbti, "items": catalog.seed_batch(user.mbti)}


@router.get(settings.api_prefix + "/feed", response_model=FeedResponse)
def feed(
    user: CurrentUser,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=6, ge=1, le=20),
):
    del user
    try:
        offset = int(cursor or "0")
    except ValueError as exc:
        raise ApiError(400, "INVALID_CURSOR", "Feed 游标无效") from exc
    items = catalog.feed()
    page = items[offset: offset + limit]
    next_cursor = str(offset + limit) if offset + limit < len(items) else None
    return {"items": page, "nextCursor": next_cursor}


@router.get(settings.api_prefix + "/media/cards/{card_id}", include_in_schema=False)
def card_media(card_id: str):
    try:
        path = catalog.media_path(card_id)
    except KeyError as exc:
        raise ApiError(404, "CARD_NOT_FOUND", "卡片不存在") from exc
    if not path.is_file():
        raise ApiError(404, "MEDIA_NOT_FOUND", "卡片视觉资产不存在")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})


@router.get(settings.api_prefix + "/media/realm/{asset_id}", include_in_schema=False)
def realm_media(asset_id: str):
    try:
        path = catalog.realm_media_path(asset_id)
    except KeyError as exc:
        raise ApiError(404, "MEDIA_NOT_FOUND", "茶境视觉资产不存在") from exc
    if not path.is_file():
        raise ApiError(404, "MEDIA_NOT_FOUND", "茶境视觉资产不存在")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@router.post(settings.api_prefix + "/swipes", response_model=SwipeResponse)
def swipe(payload: SwipeRequest, user: CurrentUser, db: Db):
    try:
        event, accepted, profile = record_swipe(db, user.id, payload.client_event_id, payload.card_id, payload.action)
    except KeyError as exc:
        raise ApiError(404, "CARD_NOT_FOUND", "卡片不存在") from exc
    db.commit()
    count = swipe_count(db, user.id)
    reveal = catalog.tea_summary(event.tea_id) if event.action in {"like", "save"} else None
    current_recommendation = recommendation(db, user.id) if count >= 5 else None
    return {
        "accepted": accepted,
        "tasteProfile": profile_response(profile),
        "reveal": reveal,
        "recommendation": current_recommendation,
        "recommendationReady": count >= 5,
    }


@router.get(settings.api_prefix + "/teas/{tea_id}", response_model=TeaDetailResponse)
def tea_detail(tea_id: str, user: CurrentUser, db: Db):
    try:
        return {**catalog.tea_detail(tea_id), "journey": tea_journey(db, user.id, tea_id)}
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc