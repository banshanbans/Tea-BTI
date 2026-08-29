from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter

from ..config import get_settings
from ..deps import Db, token_hash
from ..models import AnonymousSession, AnonymousUser, utcnow
from ..schemas import AnonymousSessionResponse
from ..taste import get_or_create_profile

settings = get_settings()
router = APIRouter()


@router.post(settings.api_prefix + "/sessions/anonymous", response_model=AnonymousSessionResponse, status_code=201)
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