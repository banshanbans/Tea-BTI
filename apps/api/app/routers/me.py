from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from ..catalog import catalog
from ..config import get_settings
from ..deps import ApiError, CurrentUser, Db, normalize_and_save
from ..models import PassportEntry, utcnow
from ..schemas import (
    DrinkFeedbackRequest, DrinkFeedbackResponse, PassportEntryResponse, PassportResponse, PassportUpdate,
    TasteNormalizeRequest, TasteNormalizeResponse, TeaBtiResponse,
)
from ..taste import get_or_create_passport, passport_response, profile_response, record_drink_feedback, tea_bti

settings = get_settings()
router = APIRouter()


@router.post(settings.api_prefix + "/drink-feedback", response_model=DrinkFeedbackResponse)
def drink_feedback(payload: DrinkFeedbackRequest, user: CurrentUser, db: Db):
    try:
        catalog.require_tea(payload.tea_id)
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc
    profile, entry = record_drink_feedback(
        db, user.id, payload.tea_id, payload.result, payload.user_words, payload.infusion_number,
    )
    db.commit()
    return {"tasteProfile": profile_response(profile), "passportEntry": passport_response(entry, db)}


@router.post(settings.api_prefix + "/taste/normalize", response_model=TasteNormalizeResponse)
async def taste_normalize(payload: TasteNormalizeRequest, user: CurrentUser, db: Db):
    return await normalize_and_save(db, user.id, payload.tea_id, payload.text, payload.infusion_number)


@router.get(settings.api_prefix + "/me/passport", response_model=PassportResponse)
def passport(user: CurrentUser, db: Db):
    entries = db.scalars(select(PassportEntry).where(PassportEntry.user_id == user.id).order_by(PassportEntry.updated_at.desc())).all()
    return {"items": [passport_response(entry, db) for entry in entries]}


@router.put(settings.api_prefix + "/me/passport/{tea_id}", response_model=PassportEntryResponse)
def update_passport(tea_id: str, payload: PassportUpdate, user: CurrentUser, db: Db):
    try:
        catalog.require_tea(tea_id)
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc
    entry = get_or_create_passport(db, user.id, tea_id)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(entry, key, value)
    if payload.brewed or payload.tasted:
        entry.first_drunk_at = entry.first_drunk_at or utcnow()
    db.commit()
    return passport_response(entry, db)


@router.get(settings.api_prefix + "/me/tea-bti", response_model=TeaBtiResponse)
def get_tea_bti(user: CurrentUser, db: Db):
    return tea_bti(db, user.id)