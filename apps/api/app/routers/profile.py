from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header

from ..config import get_settings
from ..deps import CurrentUser, Db, raise_profile_error
from ..profile import (
    ProfileError, create_profile_share, private_profile_response, public_profile_response,
    record_profile_event, require_public_share, revoke_profile_share, update_profile,
)
from ..schemas import (
    PrivateProfileEventRequest, ProfileEventResponse, ProfileShareMutationResponse, ProfileShareRequest,
    PublicProfileEventRequest, PublicTeaProfileResponse, TeaProfileMutationResponse, TeaProfileResponse, TeaProfileUpdate,
)

settings = get_settings()
router = APIRouter()


@router.get(settings.api_prefix + "/me/profile", response_model=TeaProfileResponse)
def get_tea_profile(user: CurrentUser, db: Db):
    result = private_profile_response(db, user.id)
    db.commit()
    return result


@router.put(settings.api_prefix + "/me/profile", response_model=TeaProfileMutationResponse)
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


@router.post(settings.api_prefix + "/me/profile/share", response_model=ProfileShareMutationResponse)
def post_profile_share(payload: ProfileShareRequest, user: CurrentUser, db: Db):
    try:
        return create_profile_share(db, user.id, payload.client_event_id)
    except ProfileError as exc:
        raise_profile_error(exc)


@router.delete(settings.api_prefix + "/me/profile/share", response_model=ProfileShareMutationResponse)
def delete_profile_share(
    user: CurrentUser,
    db: Db,
    client_event_id: Annotated[
        str,
        Header(alias="X-Client-Event-Id", min_length=1, max_length=80),
    ],
):
    return revoke_profile_share(db, user.id, client_event_id)


@router.post(settings.api_prefix + "/me/profile/events", response_model=ProfileEventResponse)
def post_profile_event(payload: PrivateProfileEventRequest, user: CurrentUser, db: Db):
    accepted = record_profile_event(db, user.id, payload.client_event_id, payload.event_type, {})
    db.commit()
    return {"accepted": accepted}


@router.get(settings.api_prefix + "/public/profiles/{public_id}", response_model=PublicTeaProfileResponse)
def get_public_profile(public_id: str, db: Db):
    try:
        return public_profile_response(db, require_public_share(db, public_id))
    except ProfileError as exc:
        raise_profile_error(exc)


@router.post(settings.api_prefix + "/public/profiles/{public_id}/events", response_model=ProfileEventResponse)
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