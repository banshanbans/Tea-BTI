from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import catalog
from .models import AnalyticsEvent, PassportEntry, RealmProgress, RealmSpecimen, utcnow
from .taste import get_or_create_passport, passport_response


@dataclass
class RealmError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


def as_utc(value: datetime | None) -> datetime | None:
    """SQLite drops timezone metadata; keep API timestamps stable across reloads."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _scene_order(realm: dict[str, Any]) -> list[str]:
    return [scene["id"] for scene in realm["scenes"]]


def _find_progress(db: Session, user_id: str, realm_id: str) -> RealmProgress | None:
    return db.scalar(select(RealmProgress).where(RealmProgress.user_id == user_id, RealmProgress.realm_id == realm_id))


def _get_or_create_progress(db: Session, user_id: str, realm: dict[str, Any]) -> RealmProgress:
    progress = _find_progress(db, user_id, realm["id"])
    if progress is None:
        progress = RealmProgress(
            id=str(uuid.uuid4()),
            user_id=user_id,
            realm_id=realm["id"],
            tea_id=realm["teaId"],
            current_scene=_scene_order(realm)[0],
            completed_scenes=[],
        )
        db.add(progress)
        db.flush()
    return progress


def _find_specimen(db: Session, user_id: str, realm_id: str, specimen_id: str) -> RealmSpecimen | None:
    return db.scalar(select(RealmSpecimen).where(
        RealmSpecimen.user_id == user_id,
        RealmSpecimen.realm_id == realm_id,
        RealmSpecimen.specimen_id == specimen_id,
    ))


def _progress_response(realm: dict[str, Any], progress: RealmProgress | None) -> dict[str, Any]:
    first_scene = _scene_order(realm)[0]
    if progress is None:
        return {
            "realmId": realm["id"],
            "teaId": realm["teaId"],
            "status": "available",
            "currentScene": first_scene,
            "completedScenes": [],
            "interactionMode": None,
            "totalElapsedMs": 0,
            "replayCount": 0,
            "startedAt": None,
            "updatedAt": None,
            "completedAt": None,
            "usedTasteWords": False,
        }
    return {
        "realmId": progress.realm_id,
        "teaId": progress.tea_id,
        "status": "completed" if progress.completed_at else "in_progress",
        "currentScene": progress.current_scene,
        "completedScenes": progress.completed_scenes or [],
        "interactionMode": progress.interaction_mode,
        "totalElapsedMs": progress.total_elapsed_ms,
        "replayCount": progress.replay_count,
        "startedAt": as_utc(progress.started_at),
        "updatedAt": as_utc(progress.updated_at),
        "completedAt": as_utc(progress.completed_at),
        "usedTasteWords": progress.used_taste_words,
    }


def _specimen_response(realm: dict[str, Any], specimen: RealmSpecimen) -> dict[str, Any]:
    definition = realm["specimen"]
    return {
        "specimenId": specimen.specimen_id,
        "realmId": specimen.realm_id,
        "name": definition["name"],
        "description": definition["description"],
        "asset": catalog.realm_asset(definition["assetId"]),
        "collectedAt": as_utc(specimen.collected_at),
    }


def _record_event(db: Session, user_id: str, client_event_id: str, name: str, payload: dict[str, Any]) -> bool:
    existing = db.scalar(select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == user_id,
        AnalyticsEvent.client_event_id == client_event_id,
    ))
    if existing:
        return False
    db.add(AnalyticsEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        client_event_id=client_event_id,
        name=name,
        payload=payload,
    ))
    db.flush()
    return True


def _personalization(db: Session, user_id: str, realm: dict[str, Any]) -> dict[str, Any]:
    entry = db.scalar(select(PassportEntry).where(
        PassportEntry.user_id == user_id,
        PassportEntry.tea_id == realm["teaId"],
    ))
    if entry and entry.user_description:
        return {
            "source": "taste",
            "introCopy": realm["tasteIntroTemplate"].format(userWords=entry.user_description),
            "userWords": entry.user_description,
            "normalizedTags": entry.normalized_tags or [],
        }
    return {
        "source": "default",
        "introCopy": realm["defaultIntro"],
        "userWords": None,
        "normalizedTags": [],
    }


def list_realms(db: Session, user_id: str) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    lit_regions: list[str] = []
    for realm in catalog.realms.values():
        progress = _find_progress(db, user_id, realm["id"])
        specimen = _find_specimen(db, user_id, realm["id"], realm["specimen"]["id"])
        if progress and progress.completed_at:
            lit_regions.append(realm["regionId"])
        items.append({
            "realmId": realm["id"],
            "teaId": realm["teaId"],
            "title": realm["title"],
            "subtitle": realm["subtitle"],
            "regionId": realm["regionId"],
            "regionLabel": realm["regionLabel"],
            "progress": _progress_response(realm, progress),
            "specimen": _specimen_response(realm, specimen) if specimen else None,
            "heroAsset": catalog.realm_asset("realm-duyun-mountain"),
        })
    return {"items": items, "litRegionIds": list(dict.fromkeys(lit_regions))}


def get_realm_detail(db: Session, user_id: str, realm_id: str) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    return {
        "definition": catalog.realm_definition(realm_id),
        "progress": _progress_response(realm, _find_progress(db, user_id, realm_id)),
        "personalization": _personalization(db, user_id, realm),
    }


def start_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, interaction_mode: str, fallback_reason: str | None, replay: bool) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    existing_event = db.scalar(select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == user_id,
        AnalyticsEvent.client_event_id == client_event_id,
    ))
    progress = _get_or_create_progress(db, user_id, realm)
    if existing_event:
        return {"accepted": False, "progress": _progress_response(realm, progress)}
    progress.interaction_mode = interaction_mode
    if replay and progress.completed_at:
        progress.replay_count += 1
    _record_event(db, user_id, client_event_id, "realm_started", {
        "realmId": realm_id,
        "interactionMode": interaction_mode,
        "replay": replay,
        "hasFallback": bool(fallback_reason),
    })
    if fallback_reason:
        _record_event(db, user_id, client_event_id[:60] + ":fallback", "realm_interaction_fallback_used", {
            "realmId": realm_id,
            "interactionMode": interaction_mode,
            "fallbackReason": fallback_reason,
        })
    db.commit()
    return {"accepted": True, "progress": _progress_response(realm, progress)}


def record_realm_event(db: Session, user_id: str, realm_id: str, *, client_event_id: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    accepted = _record_event(db, user_id, client_event_id, event_type, {"realmId": realm_id, **payload})
    db.commit()
    return {"accepted": accepted, "progress": _progress_response(realm, _find_progress(db, user_id, realm_id))}


def advance_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, completed_scene: str, elapsed_ms: int) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _get_or_create_progress(db, user_id, realm)
    if db.scalar(select(AnalyticsEvent).where(AnalyticsEvent.user_id == user_id, AnalyticsEvent.client_event_id == client_event_id)):
        return {"accepted": False, "progress": _progress_response(realm, progress)}
    completed = list(progress.completed_scenes or [])
    if completed_scene in completed:
        return {"accepted": False, "progress": _progress_response(realm, progress)}
    order = _scene_order(realm)
    expected = order[len(completed)] if len(completed) < len(order) else None
    if completed_scene != expected or completed_scene == order[-1]:
        raise RealmError(409, "REALM_SCENE_OUT_OF_ORDER", "茶境场景必须按顺序完成", {
            "expectedScene": expected,
            "receivedScene": completed_scene,
        })
    completed.append(completed_scene)
    progress.completed_scenes = completed
    progress.current_scene = order[len(completed)]
    progress.total_elapsed_ms += elapsed_ms
    _record_event(db, user_id, client_event_id, "realm_scene_completed", {
        "realmId": realm_id,
        "sceneId": completed_scene,
        "elapsedMs": elapsed_ms,
        "interactionMode": progress.interaction_mode,
    })
    db.commit()
    return {"accepted": True, "progress": _progress_response(realm, progress)}


def complete_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, total_elapsed_ms: int, interaction_mode: str) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _find_progress(db, user_id, realm_id)
    order = _scene_order(realm)
    required = order[:-1]
    if progress is None or not all(scene in (progress.completed_scenes or []) for scene in required):
        raise RealmError(409, "REALM_COMPLETION_INCOMPLETE", "请先完成前面的茶境场景", {
            "requiredScenes": required,
            "completedScenes": progress.completed_scenes if progress else [],
        })
    specimen_def = realm["specimen"]
    specimen = _find_specimen(db, user_id, realm_id, specimen_def["id"])
    accepted = progress.completed_at is None
    if accepted:
        entry = get_or_create_passport(db, user_id, realm["teaId"])
        progress.completed_scenes = order
        progress.current_scene = order[-1]
        progress.completed_at = utcnow()
        progress.total_elapsed_ms = max(progress.total_elapsed_ms, total_elapsed_ms)
        progress.interaction_mode = interaction_mode
        progress.used_taste_words = bool(entry.user_description)
        entry.realm_unlocked = True
        specimen = RealmSpecimen(
            id=str(uuid.uuid4()),
            user_id=user_id,
            realm_id=realm_id,
            tea_id=realm["teaId"],
            specimen_id=specimen_def["id"],
        )
        db.add(specimen)
        db.flush()
        _record_event(db, user_id, client_event_id[:60] + ":specimen", "realm_specimen_collected", {
            "realmId": realm_id,
            "specimenId": specimen_def["id"],
        })
        _record_event(db, user_id, client_event_id, "realm_completed", {
            "realmId": realm_id,
            "totalElapsedMs": total_elapsed_ms,
            "interactionMode": interaction_mode,
            "usedTasteWords": progress.used_taste_words,
        })
        db.commit()
    else:
        entry = get_or_create_passport(db, user_id, realm["teaId"])
    if specimen is None:
        raise RealmError(409, "REALM_COMPLETION_INCOMPLETE", "茶境标本状态不完整")
    return {
        "accepted": accepted,
        "progress": _progress_response(realm, progress),
        "specimen": _specimen_response(realm, specimen),
        "passportEntry": passport_response(entry, db),
    }
