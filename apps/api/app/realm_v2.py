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


OUTCOME_DISCLAIMER = "这是互动体验结果，不代表真实加工批次或专业制茶能力评价。"


@dataclass
class RealmError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


def as_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _iso_now() -> str:
    return utcnow().isoformat()


def _scene_order(realm: dict[str, Any]) -> list[str]:
    return [scene["id"] for scene in realm["scenes"]]


def _find_progress(db: Session, user_id: str, realm_id: str) -> RealmProgress | None:
    return db.scalar(select(RealmProgress).where(RealmProgress.user_id == user_id, RealmProgress.realm_id == realm_id))


def _get_or_create_progress(db: Session, user_id: str, realm: dict[str, Any]) -> RealmProgress:
    progress = _find_progress(db, user_id, realm["id"])
    if progress is None:
        progress = RealmProgress(
            id=str(uuid.uuid4()), user_id=user_id, realm_id=realm["id"], tea_id=realm["teaId"],
            current_scene=_scene_order(realm)[0], completed_scenes=[],
        )
        db.add(progress)
        db.flush()
    return progress


def _find_specimen(db: Session, user_id: str, realm_id: str, specimen_id: str) -> RealmSpecimen | None:
    return db.scalar(select(RealmSpecimen).where(
        RealmSpecimen.user_id == user_id, RealmSpecimen.realm_id == realm_id,
        RealmSpecimen.specimen_id == specimen_id,
    ))


def _progress_response(realm: dict[str, Any], progress: RealmProgress | None) -> dict[str, Any]:
    first_scene = _scene_order(realm)[0]
    if progress is None:
        return {
            "realmId": realm["id"], "teaId": realm["teaId"], "status": "available",
            "currentScene": first_scene, "completedScenes": [], "interactionMode": None,
            "totalElapsedMs": 0, "replayCount": 0, "startedAt": None, "updatedAt": None,
            "completedAt": None, "usedTasteWords": False,
        }
    return {
        "realmId": progress.realm_id, "teaId": progress.tea_id,
        "status": "completed" if progress.completed_at else "in_progress",
        "currentScene": progress.current_scene, "completedScenes": progress.completed_scenes or [],
        "interactionMode": progress.interaction_mode, "totalElapsedMs": progress.total_elapsed_ms,
        "replayCount": progress.replay_count, "startedAt": as_utc(progress.started_at),
        "updatedAt": as_utc(progress.updated_at), "completedAt": as_utc(progress.completed_at),
        "usedTasteWords": progress.used_taste_words,
    }


def _new_run(realm: dict[str, Any], *, replay: bool, interaction_mode: str) -> dict[str, Any]:
    now = _iso_now()
    return {
        "runId": str(uuid.uuid4()), "replay": replay, "currentScene": _scene_order(realm)[0],
        "completedScenes": [], "sceneResults": {}, "interactionMode": interaction_mode,
        "totalElapsedMs": 0, "startedAt": now, "updatedAt": now, "completedAt": None,
    }


def _run_response(progress: RealmProgress | None) -> dict[str, Any] | None:
    return dict(progress.run_state) if progress and progress.run_state else None


def _mutation_response(realm: dict[str, Any], progress: RealmProgress, *, accepted: bool) -> dict[str, Any]:
    return {"accepted": accepted, "progress": _progress_response(realm, progress), "run": _run_response(progress)}


def _specimen_response(realm: dict[str, Any], specimen: RealmSpecimen) -> dict[str, Any]:
    definition = realm["specimen"]
    return {
        "specimenId": specimen.specimen_id, "realmId": specimen.realm_id,
        "name": definition["name"], "description": definition["description"],
        "asset": catalog.realm_asset(definition["assetId"]), "collectedAt": as_utc(specimen.collected_at),
    }


def _record_event(db: Session, user_id: str, client_event_id: str, name: str, payload: dict[str, Any]) -> bool:
    existing = db.scalar(select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == user_id, AnalyticsEvent.client_event_id == client_event_id,
    ))
    if existing:
        return False
    db.add(AnalyticsEvent(
        id=str(uuid.uuid4()), user_id=user_id, client_event_id=client_event_id, name=name, payload=payload,
    ))
    db.flush()
    return True


def _personalization(db: Session, user_id: str, realm: dict[str, Any]) -> dict[str, Any]:
    entry = db.scalar(select(PassportEntry).where(
        PassportEntry.user_id == user_id, PassportEntry.tea_id == realm["teaId"],
    ))
    if entry and entry.user_description:
        return {
            "source": "taste", "introCopy": realm["tasteIntroTemplate"].format(userWords=entry.user_description),
            "userWords": entry.user_description, "normalizedTags": entry.normalized_tags or [],
        }
    return {"source": "default", "introCopy": realm["defaultIntro"], "userWords": None, "normalizedTags": []}


def _require_run(progress: RealmProgress, run_id: str) -> dict[str, Any]:
    run = dict(progress.run_state or {})
    if not run or run.get("runId") != run_id:
        raise RealmError(409, "REALM_RUN_MISMATCH", "这次茶境体验已变化，请刷新后继续", {
            "currentRunId": run.get("runId"), "receivedRunId": run_id,
        })
    return run


def _validate_scene_result(completed_scene: str, scene_result: dict[str, Any] | None) -> None:
    expected = {"pick-bud": "pick-bud", "wok-craft": "wok-craft", "human-judgment": "human-judgment"}.get(completed_scene)
    if expected and (not scene_result or scene_result.get("kind") != expected):
        raise RealmError(422, "REALM_SCENE_RESULT_INVALID", "这一幕的互动结果不完整", {
            "sceneId": completed_scene, "expectedKind": expected,
        })
    if not expected and scene_result is not None:
        raise RealmError(422, "REALM_SCENE_RESULT_INVALID", "这一幕不接收互动结果", {"sceneId": completed_scene})
    if completed_scene == "wok-craft" and scene_result:
        required = {"killGreen", "rolling", "balling", "pekoe"}
        received = set((scene_result.get("gestures") or {}).keys())
        if received != required:
            raise RealmError(422, "REALM_SCENE_RESULT_INVALID", "四道制茶动作需要全部完成", {
                "requiredGestures": sorted(required), "receivedGestures": sorted(received),
            })


def _build_outcome(run: dict[str, Any]) -> dict[str, Any]:
    results = run.get("sceneResults") or {}
    stop_window = (results.get("human-judgment") or {}).get("stopWindow")
    templates = {
        "early": ("鲜青的一芽", "你让这一芽早一点离锅，叶色更鲜，青气也更明显。"),
        "balanced": ("清鲜的白毫", "你把这一芽停在青气刚退、白毫渐显的时候，鲜爽与清甜更平衡。"),
        "late": ("带火香的一芽", "你让这一芽多留了一会儿，火香更明显，叶形也收得更紧。"),
    }
    if stop_window not in templates:
        raise RealmError(409, "REALM_OUTCOME_INCOMPLETE", "请先完成起锅判断")
    pick = results.get("pick-bud") or {}
    gestures = list(((results.get("wok-craft") or {}).get("gestures") or {}).values())
    avg_score = sum(int(item.get("score", 0)) for item in gestures) / max(1, len(gestures))
    if not pick.get("wrongSelections") and avg_score >= 80:
        modifier = "你认芽很快，四手也做得稳。"
    elif pick.get("teacherShown") and avg_score >= 65:
        modifier = "你听过茶师傅一句提醒，后面的手势更稳。"
    else:
        modifier = "你在几次调整里慢慢找到自己的节奏。"
    title, lead = templates[stop_window]
    return {
        "code": stop_window, "title": title, "summary": f"{lead}{modifier}", "stopWindow": stop_window,
        "updatedAt": _iso_now(), "disclaimer": OUTCOME_DISCLAIMER,
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
            "realmId": realm["id"], "teaId": realm["teaId"], "title": realm["title"],
            "subtitle": realm["subtitle"], "regionId": realm["regionId"], "regionLabel": realm["regionLabel"],
            "progress": _progress_response(realm, progress),
            "specimen": _specimen_response(realm, specimen) if specimen else None,
            "heroAsset": catalog.realm_asset("realm-duyun-mountain"),
            "outcome": progress.latest_outcome if progress else None,
        })
    return {"items": items, "litRegionIds": list(dict.fromkeys(lit_regions))}


def get_realm_detail(db: Session, user_id: str, realm_id: str) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _find_progress(db, user_id, realm_id)
    return {
        "definition": catalog.realm_definition(realm_id), "progress": _progress_response(realm, progress),
        "personalization": _personalization(db, user_id, realm), "run": _run_response(progress),
        "outcome": progress.latest_outcome if progress else None,
    }


def start_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, interaction_mode: str, fallback_reason: str | None, replay: bool) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _get_or_create_progress(db, user_id, realm)
    existing_event = db.scalar(select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == user_id, AnalyticsEvent.client_event_id == client_event_id,
    ))
    if existing_event:
        return _mutation_response(realm, progress, accepted=False)
    existing_run = progress.run_state or {}
    should_start_new = not existing_run or replay or bool(existing_run.get("completedAt"))
    if should_start_new:
        is_replay = bool(progress.completed_at)
        progress.run_state = _new_run(realm, replay=is_replay, interaction_mode=interaction_mode)
        if is_replay:
            progress.replay_count += 1
    else:
        run = dict(existing_run)
        run.update({"interactionMode": interaction_mode, "updatedAt": _iso_now()})
        progress.run_state = run
    progress.interaction_mode = interaction_mode
    _record_event(db, user_id, client_event_id, "realm_started", {
        "realmId": realm_id, "runId": progress.run_state["runId"], "interactionMode": interaction_mode,
        "replay": bool(progress.run_state["replay"]), "hasFallback": bool(fallback_reason),
    })
    if fallback_reason:
        _record_event(db, user_id, client_event_id[:60] + ":fallback", "realm_interaction_fallback_used", {
            "realmId": realm_id, "runId": progress.run_state["runId"],
            "interactionMode": interaction_mode, "fallbackReason": fallback_reason,
        })
    db.commit()
    return _mutation_response(realm, progress, accepted=True)


def record_realm_event(db: Session, user_id: str, realm_id: str, *, client_event_id: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _get_or_create_progress(db, user_id, realm)
    accepted = _record_event(db, user_id, client_event_id, event_type, {"realmId": realm_id, **payload})
    db.commit()
    return _mutation_response(realm, progress, accepted=accepted)


def advance_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, run_id: str, completed_scene: str, scene_result: dict[str, Any] | None, elapsed_ms: int) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _get_or_create_progress(db, user_id, realm)
    run = _require_run(progress, run_id)
    if db.scalar(select(AnalyticsEvent).where(AnalyticsEvent.user_id == user_id, AnalyticsEvent.client_event_id == client_event_id)):
        return _mutation_response(realm, progress, accepted=False)
    completed = list(run.get("completedScenes") or [])
    if completed_scene in completed:
        return _mutation_response(realm, progress, accepted=False)
    order = _scene_order(realm)
    expected = order[len(completed)] if len(completed) < len(order) else None
    if completed_scene != expected or completed_scene == order[-1]:
        raise RealmError(409, "REALM_SCENE_OUT_OF_ORDER", "茶境场景必须按顺序完成", {
            "expectedScene": expected, "receivedScene": completed_scene,
        })
    _validate_scene_result(completed_scene, scene_result)
    completed.append(completed_scene)
    results = dict(run.get("sceneResults") or {})
    if scene_result is not None:
        results[completed_scene] = scene_result
    run.update({
        "completedScenes": completed, "sceneResults": results, "currentScene": order[len(completed)],
        "totalElapsedMs": int(run.get("totalElapsedMs", 0)) + elapsed_ms, "updatedAt": _iso_now(),
    })
    progress.run_state = run
    if progress.completed_at is None:
        progress.completed_scenes = completed
        progress.current_scene = run["currentScene"]
        progress.total_elapsed_ms = run["totalElapsedMs"]
    _record_event(db, user_id, client_event_id, "realm_scene_completed", {
        "realmId": realm_id, "runId": run_id, "sceneId": completed_scene,
        "elapsedMs": elapsed_ms, "interactionMode": run.get("interactionMode"),
    })
    db.commit()
    return _mutation_response(realm, progress, accepted=True)


def complete_realm(db: Session, user_id: str, realm_id: str, *, client_event_id: str, run_id: str, total_elapsed_ms: int, interaction_mode: str) -> dict[str, Any]:
    try:
        realm = catalog.require_realm(realm_id)
    except KeyError as exc:
        raise RealmError(404, "REALM_NOT_FOUND", "茶境不存在") from exc
    progress = _find_progress(db, user_id, realm_id)
    order = _scene_order(realm)
    if progress is None:
        raise RealmError(409, "REALM_COMPLETION_INCOMPLETE", "请先完成前面的茶境场景")
    run = _require_run(progress, run_id)
    required = order[:-1]
    if not all(scene in (run.get("completedScenes") or []) for scene in required):
        raise RealmError(409, "REALM_COMPLETION_INCOMPLETE", "请先完成前面的茶境场景", {
            "requiredScenes": required, "completedScenes": run.get("completedScenes") or [],
        })
    specimen_def = realm["specimen"]
    specimen = _find_specimen(db, user_id, realm_id, specimen_def["id"])
    duplicate_run = bool(run.get("completedAt"))
    specimen_awarded = False
    if not duplicate_run:
        outcome = _build_outcome(run)
        now = _iso_now()
        run.update({
            "completedScenes": order, "currentScene": order[-1],
            "totalElapsedMs": max(int(run.get("totalElapsedMs", 0)), total_elapsed_ms),
            "interactionMode": interaction_mode, "updatedAt": now, "completedAt": now,
        })
        progress.run_state = run
        progress.latest_outcome = outcome
        entry = get_or_create_passport(db, user_id, realm["teaId"])
        if progress.completed_at is None:
            progress.completed_scenes = order
            progress.current_scene = order[-1]
            progress.completed_at = utcnow()
            progress.total_elapsed_ms = max(progress.total_elapsed_ms, total_elapsed_ms)
            progress.interaction_mode = interaction_mode
            progress.used_taste_words = bool(entry.user_description)
            entry.realm_unlocked = True
            if specimen is None:
                specimen = RealmSpecimen(
                    id=str(uuid.uuid4()), user_id=user_id, realm_id=realm_id,
                    tea_id=realm["teaId"], specimen_id=specimen_def["id"],
                )
                db.add(specimen)
                db.flush()
                specimen_awarded = True
                _record_event(db, user_id, client_event_id[:60] + ":specimen", "realm_specimen_collected", {
                    "realmId": realm_id, "specimenId": specimen_def["id"],
                })
        _record_event(db, user_id, client_event_id, "realm_completed", {
            "realmId": realm_id, "runId": run_id, "totalElapsedMs": total_elapsed_ms,
            "interactionMode": interaction_mode, "outcome": outcome["code"],
            "specimenAwarded": specimen_awarded,
        })
        db.commit()
    else:
        outcome = progress.latest_outcome
        entry = get_or_create_passport(db, user_id, realm["teaId"])
    if specimen is None or outcome is None:
        raise RealmError(409, "REALM_COMPLETION_INCOMPLETE", "茶境完成状态不完整")
    return {
        "accepted": not duplicate_run, "progress": _progress_response(realm, progress),
        "run": _run_response(progress), "outcome": outcome,
        "specimen": _specimen_response(realm, specimen), "specimenAwarded": specimen_awarded,
        "passportEntry": passport_response(entry, db),
    }
