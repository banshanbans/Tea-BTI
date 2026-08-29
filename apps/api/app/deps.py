from __future__ import annotations

import hashlib
from typing import Annotated, Any

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import catalog
from .config import get_settings
from .db import get_db
from .models import AnonymousSession, AnonymousUser, utcnow
from .profile import ProfileError
from .realm import RealmError
from .taste import passport_response, profile_response, record_drink_feedback
from .voice import taste_normalizer

settings = get_settings()


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> AnonymousUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "AUTH_REQUIRED", "需要匿名会话 Token")
    token = authorization.removeprefix("Bearer ").strip()
    session = db.scalar(select(AnonymousSession).where(AnonymousSession.token_hash == token_hash(token)))
    if session is None:
        raise ApiError(401, "AUTH_INVALID", "匿名会话已失效")
    session.last_seen_at = utcnow()
    user = db.get(AnonymousUser, session.user_id)
    if user is None:
        raise ApiError(401, "AUTH_INVALID", "匿名用户不存在")
    db.commit()
    return user


Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AnonymousUser, Depends(require_user)]


def capabilities_payload() -> dict:
    real = settings.voice_real_enabled
    return {
        "voice": "real" if real else "unavailable" if settings.ai_mode == "volcengine" else "mock",
        "tasteNormalization": "real" if settings.ai_mode != "mock" and bool(settings.ark_api_key) else "mock",
        "missingConfig": [] if real else settings.voice_missing_config,
    }


def raise_realm_error(exc: RealmError) -> None:
    raise ApiError(exc.status_code, exc.code, exc.message, details=exc.details) from exc


def raise_profile_error(exc: ProfileError) -> None:
    raise ApiError(exc.status_code, exc.code, exc.message, details=exc.details) from exc


async def normalize_and_save(db: Session, user_id: str, tea_id: str, text: str, infusion_number: int | None) -> dict:
    try:
        catalog.require_tea(tea_id)
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc
    tags, explanation, provider_mode = await taste_normalizer.normalize(tea_id, text)
    profile, entry = record_drink_feedback(db, user_id, tea_id, "neutral", text, infusion_number, tags)
    db.commit()
    return {
        "userWords": text,
        "normalizedTags": tags,
        "explanation": explanation,
        "providerMode": provider_mode,
        "tasteProfile": profile_response(profile),
        "passportEntry": passport_response(entry, db),
    }