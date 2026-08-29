from __future__ import annotations

import uuid
from datetime import timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..catalog import catalog
from ..config import get_settings
from ..deps import ApiError, CurrentUser, Db, normalize_and_save
from ..models import VoiceSession, VoiceTurn, utcnow
from ..schemas import (
    VoiceContextUpdate, VoiceSessionCreate, VoiceSessionResponse, VoiceStopRequest, VoiceStopResponse,
    VoiceTurnsRequest, VoiceTurnsResponse,
)
from ..taste import get_or_create_passport, tea_journey
from ..voice import ProviderError, voice_provider

settings = get_settings()
router = APIRouter()


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


@router.post(settings.api_prefix + "/voice/sessions", response_model=VoiceSessionResponse, status_code=201)
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


@router.post(settings.api_prefix + "/voice/sessions/{session_id}/start", response_model=VoiceSessionResponse)
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


@router.patch(settings.api_prefix + "/voice/sessions/{session_id}/context", response_model=VoiceSessionResponse)
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


@router.post(settings.api_prefix + "/voice/sessions/{session_id}/turns", response_model=VoiceTurnsResponse)
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


@router.post(settings.api_prefix + "/voice/sessions/{session_id}/stop", response_model=VoiceStopResponse)
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