"""Tea Passport 路由：读 / 写「真正喝过的茶」。

GET  /api/passport?user_id=...
POST /api/passport {user_id, tea_id, ...}
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from schemas import PassportIn, PassportOut, tea_out_from_model
from services import memory

router = APIRouter(prefix="/api", tags=["passport"])


def _to_out(entry) -> PassportOut:
    tea = getattr(entry, "tea", None)
    return PassportOut(
        user_id=entry.user_id,
        tea_id=entry.tea_id,
        first_drunk_at=entry.first_drunk_at,
        favorite_infusion=entry.favorite_infusion,
        user_description=entry.user_description,
        normalized_tags=entry.normalized_tags,
        brewed=entry.brewed,
        tasted=entry.tasted,
        realm_unlocked=entry.realm_unlocked,
        tea=tea_out_from_model(tea) if tea is not None else None,
    )


@router.get("/passport")
def get_passport(user_id: str, db: Session = Depends(get_db)):
    entries = memory.get_passport(db, user_id)
    return [_to_out(e) for e in entries]


@router.post("/passport", response_model=PassportOut)
def add_passport(payload: PassportIn, db: Session = Depends(get_db)):
    # 仅传入显式为真的布尔，避免部分更新时把已解锁标记重置
    kwargs = {
        "first_drunk_at": payload.first_drunk_at,
        "favorite_infusion": payload.favorite_infusion,
        "user_description": payload.user_description,
        "normalized_tags": payload.normalized_tags,
    }
    if payload.brewed:
        kwargs["brewed"] = True
    if payload.tasted:
        kwargs["tasted"] = True
    if payload.realm_unlocked:
        kwargs["realm_unlocked"] = True

    entry = memory.add_passport_entry(
        db, payload.user_id, payload.tea_id, **kwargs
    )
    return _to_out(entry)
