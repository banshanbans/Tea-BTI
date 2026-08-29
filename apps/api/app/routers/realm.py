from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings
from ..deps import CurrentUser, Db, raise_realm_error
from ..realm import (
    RealmError, advance_realm, complete_realm, get_realm_detail, list_realms,
    record_realm_event, start_realm,
)
from ..schemas import (
    RealmCompleteRequest, RealmCompleteResponse, RealmDetailResponse, RealmEventRequest,
    RealmListResponse, RealmMutationResponse, RealmProgressUpdate, RealmStartRequest,
)

settings = get_settings()
router = APIRouter()


@router.get(settings.api_prefix + "/realms", response_model=RealmListResponse)
def realms(user: CurrentUser, db: Db):
    return list_realms(db, user.id)


@router.get(settings.api_prefix + "/realms/{realm_id}", response_model=RealmDetailResponse)
def realm_detail(realm_id: str, user: CurrentUser, db: Db):
    try:
        return get_realm_detail(db, user.id, realm_id)
    except RealmError as exc:
        raise_realm_error(exc)


@router.post(settings.api_prefix + "/realms/{realm_id}/start", response_model=RealmMutationResponse)
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


@router.patch(settings.api_prefix + "/realms/{realm_id}/progress", response_model=RealmMutationResponse)
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


@router.post(settings.api_prefix + "/realms/{realm_id}/events", response_model=RealmMutationResponse)
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


@router.post(settings.api_prefix + "/realms/{realm_id}/complete", response_model=RealmCompleteResponse)
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