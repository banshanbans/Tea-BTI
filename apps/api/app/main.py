from __future__ import annotations

import hashlib
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .catalog import catalog
from .config import get_settings
from .db import Base, engine, get_db
from .models import AnonymousSession, AnonymousUser, PassportEntry, SwipeEvent, VoiceSession, VoiceTurn, utcnow
from .profile import (
    ProfileError, create_profile_share, private_profile_response, public_profile_response,
    record_profile_event, require_public_share, revoke_profile_share, update_profile,
)
from .realm import RealmError, advance_realm, complete_realm, get_realm_detail, list_realms, record_realm_event, start_realm
from .schemas import (
    AnonymousSessionResponse, BootstrapResponse, CapabilitiesResponse, DrinkFeedbackRequest,
    DrinkFeedbackResponse, FeedResponse, PassportEntryResponse, PassportResponse, PassportUpdate,
    SeedBatchResponse, SeedRequest, SwipeRequest, SwipeResponse, TasteNormalizeRequest,
    TasteNormalizeResponse, TeaBtiResponse, TeaDetailResponse, VoiceContextUpdate, VoiceSessionCreate,
    VoiceSessionResponse, VoiceStopRequest, VoiceStopResponse, VoiceTurnsRequest, VoiceTurnsResponse,
    ErrorResponse,
    RealmCompleteRequest, RealmCompleteResponse, RealmDetailResponse, RealmEventRequest,
    RealmListResponse, RealmMutationResponse, RealmProgressUpdate, RealmStartRequest,
    PrivateProfileEventRequest, ProfileEventResponse, ProfileShareMutationResponse,
    ProfileShareRequest, PublicProfileEventRequest, PublicTeaProfileResponse,
    TeaProfileMutationResponse, TeaProfileResponse, TeaProfileUpdate,
)
from .taste import (
    get_or_create_passport, get_or_create_profile, passport_response, profile_response, recommendation,
    record_drink_feedback, record_swipe, swipe_count, tea_bti, tea_journey,
)
from .voice import ProviderError, taste_normalizer, voice_provider


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Tea-BTI 前端、后端与 AI 语音首版契约。",
    openapi_version="3.1.0",
    lifespan=lifespan,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.web_origin.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}


def error_payload(request: Request, code: str, message: str, retryable: bool = False, details: dict[str, Any] | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": getattr(request.state, "request_id", str(uuid.uuid4())),
            "retryable": retryable,
            "details": details or {},
        }
    }


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(request, exc.code, exc.message, exc.retryable, exc.details),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = {"fields": [{"path": ".".join(str(v) for v in error["loc"]), "message": error["msg"]} for error in exc.errors()]}
    return JSONResponse(status_code=422, content=error_payload(request, "VALIDATION_ERROR", "请求参数不符合契约", False, details))


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


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


@app.post(settings.api_prefix + "/sessions/anonymous", response_model=AnonymousSessionResponse, status_code=201)
def create_anonymous_session(db: Db):
    user_id = str(uuid.uuid4())
    access_token = secrets.token_urlsafe(32)
    now = utcnow()
    user = AnonymousUser(id=user_id)
    session = AnonymousSession(id=str(uuid.uuid4()), user_id=user_id, token_hash=token_hash(access_token), created_at=now, last_seen_at=now)
    db.add_all([user, session])
    get_or_create_profile(db, user_id)
    db.commit()
    return {"userId": user_id, "accessToken": access_token, "createdAt": now}


@app.get(settings.api_prefix + "/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    return capabilities_payload()


@app.get(settings.api_prefix + "/bootstrap", response_model=BootstrapResponse)
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


@app.post(settings.api_prefix + "/onboarding/seed", response_model=SeedBatchResponse)
def onboarding_seed(payload: SeedRequest, user: CurrentUser, db: Db):
    user.mbti = payload.mbti.value if payload.mbti else None
    user.onboarding_completed = True
    db.commit()
    return {"mbti": payload.mbti, "items": catalog.seed_batch(user.mbti)}


@app.get(settings.api_prefix + "/feed", response_model=FeedResponse)
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


@app.get(settings.api_prefix + "/media/cards/{card_id}", include_in_schema=False)
def card_media(card_id: str):
    try:
        path = catalog.media_path(card_id)
    except KeyError as exc:
        raise ApiError(404, "CARD_NOT_FOUND", "卡片不存在") from exc
    if not path.is_file():
        raise ApiError(404, "MEDIA_NOT_FOUND", "卡片视觉资产不存在")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})


@app.get(settings.api_prefix + "/media/realm/{asset_id}", include_in_schema=False)
def realm_media(asset_id: str):
    try:
        path = catalog.realm_media_path(asset_id)
    except KeyError as exc:
        raise ApiError(404, "MEDIA_NOT_FOUND", "茶境视觉资产不存在") from exc
    if not path.is_file():
        raise ApiError(404, "MEDIA_NOT_FOUND", "茶境视觉资产不存在")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@app.post(settings.api_prefix + "/swipes", response_model=SwipeResponse)
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


@app.get(settings.api_prefix + "/teas/{tea_id}", response_model=TeaDetailResponse)
def tea_detail(tea_id: str, user: CurrentUser, db: Db):
    try:
        return {**catalog.tea_detail(tea_id), "journey": tea_journey(db, user.id, tea_id)}
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc


def raise_realm_error(exc: RealmError) -> None:
    raise ApiError(exc.status_code, exc.code, exc.message, details=exc.details) from exc


def raise_profile_error(exc: ProfileError) -> None:
    raise ApiError(exc.status_code, exc.code, exc.message, details=exc.details) from exc


@app.get(settings.api_prefix + "/realms", response_model=RealmListResponse)
def realms(user: CurrentUser, db: Db):
    return list_realms(db, user.id)


@app.get(settings.api_prefix + "/realms/{realm_id}", response_model=RealmDetailResponse)
def realm_detail(realm_id: str, user: CurrentUser, db: Db):
    try:
        return get_realm_detail(db, user.id, realm_id)
    except RealmError as exc:
        raise_realm_error(exc)


@app.post(settings.api_prefix + "/realms/{realm_id}/start", response_model=RealmMutationResponse)
def realm_start(realm_id: str, payload: RealmStartRequest, user: CurrentUser, db: Db):
    try:
        return start_realm(
            db, user.id, realm_id,
            client_event_id=payload.client_event_id,
            interaction_mode=payload.interaction_mode,
            fallback_reason=payload.fallback_reason,
            replay=payload.replay,
        )
    except RealmError as exc:
        raise_realm_error(exc)


@app.patch(settings.api_prefix + "/realms/{realm_id}/progress", response_model=RealmMutationResponse)
def realm_progress(realm_id: str, payload: RealmProgressUpdate, user: CurrentUser, db: Db):
    try:
        return advance_realm(
            db, user.id, realm_id,
            client_event_id=payload.client_event_id,
            completed_scene=payload.completed_scene,
            elapsed_ms=payload.elapsed_ms,
        )
    except RealmError as exc:
        raise_realm_error(exc)


@app.post(settings.api_prefix + "/realms/{realm_id}/events", response_model=RealmMutationResponse)
def realm_event(realm_id: str, payload: RealmEventRequest, user: CurrentUser, db: Db):
    event_payload = payload.model_dump(
        exclude={"client_event_id", "event_type"}, exclude_none=True,
    )
    try:
        return record_realm_event(
            db, user.id, realm_id,
            client_event_id=payload.client_event_id,
            event_type=payload.event_type,
            payload=event_payload,
        )
    except RealmError as exc:
        raise_realm_error(exc)


@app.post(settings.api_prefix + "/realms/{realm_id}/complete", response_model=RealmCompleteResponse)
def realm_complete(realm_id: str, payload: RealmCompleteRequest, user: CurrentUser, db: Db):
    try:
        return complete_realm(
            db, user.id, realm_id,
            client_event_id=payload.client_event_id,
            total_elapsed_ms=payload.total_elapsed_ms,
            interaction_mode=payload.interaction_mode,
        )
    except RealmError as exc:
        raise_realm_error(exc)


@app.post(settings.api_prefix + "/drink-feedback", response_model=DrinkFeedbackResponse)
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


@app.post(settings.api_prefix + "/taste/normalize", response_model=TasteNormalizeResponse)
async def taste_normalize(payload: TasteNormalizeRequest, user: CurrentUser, db: Db):
    return await normalize_and_save(db, user.id, payload.tea_id, payload.text, payload.infusion_number)


@app.get(settings.api_prefix + "/me/passport", response_model=PassportResponse)
def passport(user: CurrentUser, db: Db):
    entries = db.scalars(select(PassportEntry).where(PassportEntry.user_id == user.id).order_by(PassportEntry.updated_at.desc())).all()
    return {"items": [passport_response(entry, db) for entry in entries]}


@app.put(settings.api_prefix + "/me/passport/{tea_id}", response_model=PassportEntryResponse)
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


@app.get(settings.api_prefix + "/me/tea-bti", response_model=TeaBtiResponse)
def get_tea_bti(user: CurrentUser, db: Db):
    return tea_bti(db, user.id)


@app.get(settings.api_prefix + "/me/profile", response_model=TeaProfileResponse)
def get_tea_profile(user: CurrentUser, db: Db):
    result = private_profile_response(db, user.id)
    db.commit()
    return result


@app.put(settings.api_prefix + "/me/profile", response_model=TeaProfileMutationResponse)
def put_tea_profile(payload: TeaProfileUpdate, user: CurrentUser, db: Db):
    try:
        return update_profile(
            db,
            user.id,
            client_event_id=payload.client_event_id,
            display_name=payload.display_name,
            bio=payload.bio,
            selected_tea_id=payload.selected_tea_id,
            source_feedback_id=payload.source_feedback_id,
            public_quote=payload.public_quote,
            public_block_ids=[block.value for block in payload.public_block_ids],
        )
    except ProfileError as exc:
        raise_profile_error(exc)


@app.post(settings.api_prefix + "/me/profile/share", response_model=ProfileShareMutationResponse)
def post_profile_share(payload: ProfileShareRequest, user: CurrentUser, db: Db):
    try:
        return create_profile_share(db, user.id, payload.client_event_id)
    except ProfileError as exc:
        raise_profile_error(exc)


@app.delete(settings.api_prefix + "/me/profile/share", response_model=ProfileShareMutationResponse)
def delete_profile_share(
    user: CurrentUser,
    db: Db,
    client_event_id: Annotated[
        str,
        Header(alias="X-Client-Event-Id", min_length=1, max_length=80),
    ],
):
    return revoke_profile_share(db, user.id, client_event_id)


@app.post(settings.api_prefix + "/me/profile/events", response_model=ProfileEventResponse)
def post_profile_event(payload: PrivateProfileEventRequest, user: CurrentUser, db: Db):
    accepted = record_profile_event(db, user.id, payload.client_event_id, payload.event_type, {})
    db.commit()
    return {"accepted": accepted}


@app.get(settings.api_prefix + "/public/profiles/{public_id}", response_model=PublicTeaProfileResponse)
def get_public_profile(public_id: str, db: Db):
    try:
        return public_profile_response(db, require_public_share(db, public_id))
    except ProfileError as exc:
        raise_profile_error(exc)


@app.post(settings.api_prefix + "/public/profiles/{public_id}/events", response_model=ProfileEventResponse)
def post_public_profile_event(public_id: str, payload: PublicProfileEventRequest, db: Db):
    try:
        share = require_public_share(db, public_id)
    except ProfileError as exc:
        raise_profile_error(exc)
    accepted = record_profile_event(db, share.user_id, payload.client_event_id, payload.event_type, {
        "sharePublicId": public_id,
    })
    db.commit()
    return {"accepted": accepted}


def expire_voice_sessions(db: Session, user_id: str) -> None:
    now = utcnow()
    sessions = db.scalars(select(VoiceSession).where(VoiceSession.user_id == user_id, VoiceSession.status.in_(["prepared", "active"]))).all()
    for voice_session in sessions:
        expires = voice_session.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= now:
            voice_session.status = "expired"
    db.flush()


def prune_voice_turns(db: Session) -> None:
    """Final transcript turns are operational data and never live past the configured TTL."""
    cutoff = utcnow() - timedelta(hours=settings.transcript_ttl_hours)
    db.execute(delete(VoiceTurn).where(VoiceTurn.created_at < cutoff))
    db.flush()


def voice_response(voice_session: VoiceSession, rtc: dict | None = None) -> dict:
    welcome = "你好，我是茶伴。我们慢慢来，你现在准备到哪一步了？" if voice_session.mode == "brew" else "先用你自己的话说说这一口，不需要懂茶语。"
    return {
        "voiceSessionId": voice_session.id,
        "providerMode": voice_session.provider_mode,
        "status": voice_session.status,
        "expiresAt": voice_session.expires_at,
        "welcomeMessage": welcome,
        "rtc": rtc,
    }


def require_voice_session(db: Session, user_id: str, session_id: str) -> VoiceSession:
    voice_session = db.get(VoiceSession, session_id)
    if voice_session is None or voice_session.user_id != user_id:
        raise ApiError(404, "VOICE_SESSION_NOT_FOUND", "语音会话不存在")
    return voice_session


@app.post(settings.api_prefix + "/voice/sessions", response_model=VoiceSessionResponse, status_code=201)
def create_voice_session(payload: VoiceSessionCreate, user: CurrentUser, db: Db):
    try:
        catalog.require_tea(payload.tea_id)
    except KeyError as exc:
        raise ApiError(404, "TEA_NOT_FOUND", "茶资料不存在") from exc
    expire_voice_sessions(db, user.id)
    prune_voice_turns(db)
    if settings.ai_mode == "volcengine" and not settings.voice_real_enabled:
        db.commit()
        raise ApiError(
            503,
            "VOICE_PROVIDER_UNAVAILABLE",
            "实时语音配置不完整",
            details={"missingConfig": settings.voice_missing_config},
        )
    active = db.scalar(select(VoiceSession).where(VoiceSession.user_id == user.id, VoiceSession.status.in_(["prepared", "active"])))
    if active:
        raise ApiError(409, "VOICE_SESSION_ACTIVE", "已有进行中的语音会话", details={"voiceSessionId": active.id})
    now = utcnow()
    expires_at = now + timedelta(seconds=settings.voice_session_ttl_seconds)
    provider_mode = "volcengine_rtc" if settings.voice_real_enabled else "browser_mock"
    session_id = str(uuid.uuid4())
    room_id = "tea_" + session_id.replace("-", "")[:20] if provider_mode == "volcengine_rtc" else None
    task_id = "task_" + session_id.replace("-", "")[:20] if provider_mode == "volcengine_rtc" else None
    voice_session = VoiceSession(
        id=session_id, user_id=user.id, tea_id=payload.tea_id, mode=payload.mode,
        provider_mode=provider_mode, status="prepared", room_id=room_id, task_id=task_id,
        brew_stage="prepare" if payload.mode == "brew" else None,
        expires_at=expires_at,
    )
    db.add(voice_session)
    db.commit()
    rtc = None
    if provider_mode == "volcengine_rtc":
        rtc = voice_provider.prepare(room_id, user.id, int(expires_at.timestamp()))
    return voice_response(voice_session, rtc)


@app.post(settings.api_prefix + "/voice/sessions/{session_id}/start", response_model=VoiceSessionResponse)
async def start_voice_session(session_id: str, user: CurrentUser, db: Db):
    voice_session = require_voice_session(db, user.id, session_id)
    if voice_session.status == "active":
        rtc = voice_provider.prepare(voice_session.room_id, user.id, int(voice_session.expires_at.timestamp())) if voice_session.provider_mode == "volcengine_rtc" else None
        return voice_response(voice_session, rtc)
    if voice_session.status != "prepared":
        raise ApiError(409, "VOICE_SESSION_STATE", "当前语音会话无法启动")
    if voice_session.provider_mode == "volcengine_rtc":
        try:
            await voice_provider.start(
                room_id=voice_session.room_id, task_id=voice_session.task_id, target_user_id=user.id,
                tea_id=voice_session.tea_id, mode=voice_session.mode,
            )
        except ProviderError:
            if settings.ai_mode == "volcengine":
                voice_session.status = "failed"
                db.commit()
                raise ApiError(503, "VOICE_PROVIDER_UNAVAILABLE", "实时语音暂不可用", retryable=True)
            voice_session.provider_mode = "browser_mock"
            voice_session.room_id = None
            voice_session.task_id = None
    voice_session.status = "active"
    db.commit()
    rtc = voice_provider.prepare(voice_session.room_id, user.id, int(voice_session.expires_at.timestamp())) if voice_session.provider_mode == "volcengine_rtc" else None
    return voice_response(voice_session, rtc)


@app.patch(settings.api_prefix + "/voice/sessions/{session_id}/context", response_model=VoiceSessionResponse)
async def update_voice_context(session_id: str, payload: VoiceContextUpdate, user: CurrentUser, db: Db):
    voice_session = require_voice_session(db, user.id, session_id)
    if voice_session.status != "active":
        raise ApiError(409, "VOICE_SESSION_STATE", "语音会话尚未开始")
    if payload.brew_stage is not None:
        voice_session.brew_stage = payload.brew_stage
    if payload.infusion_number is not None:
        voice_session.infusion_number = payload.infusion_number
    if voice_session.provider_mode == "volcengine_rtc":
        stage_label = payload.brew_stage or voice_session.brew_stage
        context = f"用户通过界面确认当前冲泡阶段为 {stage_label}，当前是第 {voice_session.infusion_number or 1} 泡。不要声称通过摄像头观察到该状态。"
        try:
            await voice_provider.update_context(room_id=voice_session.room_id, task_id=voice_session.task_id, message=context)
        except ProviderError as exc:
            raise ApiError(503, "VOICE_CONTEXT_UPDATE_FAILED", "语音上下文更新失败", retryable=True) from exc
    db.commit()
    return voice_response(voice_session)


@app.post(settings.api_prefix + "/voice/sessions/{session_id}/turns", response_model=VoiceTurnsResponse)
def append_voice_turns(session_id: str, payload: VoiceTurnsRequest, user: CurrentUser, db: Db):
    voice_session = require_voice_session(db, user.id, session_id)
    if voice_session.status not in {"active", "stopping"}:
        raise ApiError(409, "VOICE_SESSION_STATE", "语音会话不接受字幕")
    accepted = 0
    for turn in payload.turns:
        existing = db.scalar(select(VoiceTurn).where(VoiceTurn.voice_session_id == session_id, VoiceTurn.client_turn_id == turn.client_turn_id))
        if existing:
            continue
        db.add(VoiceTurn(
            id=str(uuid.uuid4()), voice_session_id=session_id, client_turn_id=turn.client_turn_id,
            role=turn.role, text=turn.text, started_at=turn.started_at, ended_at=turn.ended_at,
        ))
        accepted += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return {"acceptedCount": accepted}


@app.post(settings.api_prefix + "/voice/sessions/{session_id}/stop", response_model=VoiceStopResponse)
async def stop_voice_session(session_id: str, payload: VoiceStopRequest, user: CurrentUser, db: Db):
    voice_session = require_voice_session(db, user.id, session_id)
    if voice_session.status == "completed":
        journey = tea_journey(db, user.id, voice_session.tea_id)
        experience_completed = journey["brewed"] if voice_session.mode == "brew" else journey["tasted"]
        return {
            "status": "completed",
            "experienceCompleted": experience_completed,
            "journey": journey,
            "tasteResult": None,
        }
    if voice_session.status not in {"prepared", "active", "failed"}:
        raise ApiError(409, "VOICE_SESSION_STATE", "语音会话无法结束")
    voice_session.status = "stopping"
    db.commit()
    if voice_session.provider_mode == "volcengine_rtc" and voice_session.room_id and voice_session.task_id:
        try:
            await voice_provider.stop(room_id=voice_session.room_id, task_id=voice_session.task_id)
        except ProviderError:
            pass
    taste_result = None
    if voice_session.mode == "taste" and payload.save_user_text:
        taste_result = await normalize_and_save(db, user.id, voice_session.tea_id, payload.save_user_text, payload.infusion_number)
    if voice_session.mode == "brew" and voice_session.brew_stage == "complete":
        entry = get_or_create_passport(db, user.id, voice_session.tea_id)
        entry.brewed = True
        entry.first_drunk_at = entry.first_drunk_at or utcnow()
    voice_session.status = "completed"
    voice_session.completed_at = utcnow()
    db.commit()
    journey = tea_journey(db, user.id, voice_session.tea_id)
    return {
        "status": "completed",
        "experienceCompleted": bool(taste_result) if voice_session.mode == "taste" else journey["brewed"],
        "journey": journey,
        "tasteResult": taste_result,
    }
