from __future__ import annotations

import secrets
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import catalog
from .models import (
    AnalyticsEvent,
    DrinkFeedback,
    PassportEntry,
    ProfileShare,
    SwipeEvent,
    TeaProfile,
    utcnow,
)
from .taste import passport_response, tea_bti


PROFILE_BLOCK_ORDER = ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"]
PROFILE_BLOCK_TITLES = {
    "IDENTITY": "我是谁",
    "MY_TEA": "我的本命茶",
    "MY_WORDS": "我怎么形容这一口",
    "TEA_PASSPORT": "我的茶护照",
}


@dataclass
class ProfileError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


def as_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def get_or_create_tea_profile(db: Session, user_id: str) -> TeaProfile:
    profile = db.get(TeaProfile, user_id)
    if profile is None:
        profile = TeaProfile(
            user_id=user_id,
            display_name="一位喝茶的人",
            bio="",
            public_block_ids=["IDENTITY"],
        )
        db.add(profile)
        db.flush()
    return profile


def _profile_share(db: Session, user_id: str) -> ProfileShare | None:
    return db.get(ProfileShare, user_id)


def _event_exists(db: Session, user_id: str, client_event_id: str) -> bool:
    return db.scalar(select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == user_id,
        AnalyticsEvent.client_event_id == client_event_id,
    )) is not None


def record_profile_event(
    db: Session,
    user_id: str,
    client_event_id: str,
    name: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    if _event_exists(db, user_id, client_event_id):
        return False
    db.add(AnalyticsEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        client_event_id=client_event_id,
        name=name,
        payload=payload or {},
    ))
    db.flush()
    return True


def _eligible_tea_candidates(db: Session, user_id: str) -> list[dict[str, Any]]:
    scores: dict[str, float] = defaultdict(float)
    reasons: dict[str, list[str]] = defaultdict(list)

    swipes = db.scalars(select(SwipeEvent).where(
        SwipeEvent.user_id == user_id,
        SwipeEvent.action.in_(["like", "save"]),
    )).all()
    for event in swipes:
        scores[event.tea_id] += 1.5 if event.action == "save" else 1.0
        label = "收藏过" if event.action == "save" else "刷茶时喜欢过"
        if label not in reasons[event.tea_id]:
            reasons[event.tea_id].append(label)

    feedback = db.scalars(select(DrinkFeedback).where(DrinkFeedback.user_id == user_id)).all()
    feedback_weights = {"like": 3.0, "neutral": 0.5, "dislike": -1.0}
    feedback_labels = {"like": "真喝后喜欢", "neutral": "留下过品饮反馈", "dislike": "留下过真实反馈"}
    for item in feedback:
        scores[item.tea_id] += feedback_weights[item.result]
        label = feedback_labels[item.result]
        if label not in reasons[item.tea_id]:
            reasons[item.tea_id].append(label)

    entries = db.scalars(select(PassportEntry).where(PassportEntry.user_id == user_id)).all()
    for entry in entries:
        scores[entry.tea_id] += (
            (1.5 if entry.saved else 0.0)
            + (1.0 if entry.brewed else 0.0)
            + (2.0 if entry.tasted else 0.0)
            + (1.0 if entry.realm_unlocked else 0.0)
        )
        if "已进入茶护照" not in reasons[entry.tea_id]:
            reasons[entry.tea_id].append("已进入茶护照")

    tea_ids = set(reasons)
    return [
        {
            "tea": catalog.tea_summary(tea_id),
            "evidenceReasons": reasons[tea_id],
            "evidenceScore": round(scores[tea_id], 2),
        }
        for tea_id in sorted(tea_ids, key=lambda item: (-scores[item], catalog.require_tea(item)["name"]))
    ]


def _quote_candidates(db: Session, user_id: str) -> list[dict[str, Any]]:
    feedback = db.scalars(select(DrinkFeedback).where(
        DrinkFeedback.user_id == user_id,
        DrinkFeedback.user_words.is_not(None),
    ).order_by(DrinkFeedback.created_at.desc())).all()
    return [
        {
            "feedbackId": item.id,
            "tea": catalog.tea_summary(item.tea_id),
            "text": item.user_words.strip(),
            "normalizedTags": item.normalized_tags or [],
            "infusionNumber": item.infusion_number,
        }
        for item in feedback
        if item.user_words and item.user_words.strip()
    ]


def _passport_entries(db: Session, user_id: str) -> list[PassportEntry]:
    return list(db.scalars(select(PassportEntry).where(
        PassportEntry.user_id == user_id,
    ).order_by(PassportEntry.updated_at.desc())).all())


def _share_state(share: ProfileShare | None) -> dict[str, Any]:
    active = bool(share and share.public_id and share.revoked_at is None)
    return {
        "active": active,
        "publicId": share.public_id if active else None,
        "publicPath": f"/p/{share.public_id}" if active else None,
        "createdAt": as_utc(share.created_at) if share else None,
        "revokedAt": as_utc(share.revoked_at) if share else None,
    }


def _normalized_blocks(block_ids: list[str]) -> list[str]:
    requested = set(block_ids)
    requested.add("IDENTITY")
    return [block_id for block_id in PROFILE_BLOCK_ORDER if block_id in requested]


def _block_completeness(
    profile: TeaProfile,
    quote: DrinkFeedback | None,
    passport_entries: list[PassportEntry],
) -> dict[str, bool]:
    return {
        "IDENTITY": bool(profile.display_name),
        "MY_TEA": bool(profile.selected_tea_id),
        "MY_WORDS": bool(quote and profile.public_quote and profile.public_quote.strip()),
        "TEA_PASSPORT": bool(passport_entries),
    }


def _selected_quote(db: Session, profile: TeaProfile) -> DrinkFeedback | None:
    if not profile.source_feedback_id:
        return None
    quote = db.get(DrinkFeedback, profile.source_feedback_id)
    if quote is None or quote.user_id != profile.user_id or not quote.user_words or not quote.user_words.strip():
        return None
    return quote


def private_profile_response(db: Session, user_id: str) -> dict[str, Any]:
    profile = get_or_create_tea_profile(db, user_id)
    candidates = _eligible_tea_candidates(db, user_id)
    quotes = _quote_candidates(db, user_id)
    entries = _passport_entries(db, user_id)
    quote = _selected_quote(db, profile)
    public_blocks = _normalized_blocks(profile.public_block_ids or [])
    complete = _block_completeness(profile, quote, entries)
    return {
        "settings": {
            "displayName": profile.display_name,
            "bio": profile.bio,
            "selectedTeaId": profile.selected_tea_id,
            "sourceFeedbackId": profile.source_feedback_id,
            "publicQuote": profile.public_quote,
            "publicBlockIds": public_blocks,
            "updatedAt": as_utc(profile.updated_at),
        },
        "blocks": [
            {
                "blockId": block_id,
                "title": PROFILE_BLOCK_TITLES[block_id],
                "isPublic": block_id in public_blocks,
                "isComplete": complete[block_id],
            }
            for block_id in PROFILE_BLOCK_ORDER
        ],
        "teaBti": tea_bti(db, user_id),
        "selectedTea": catalog.tea_summary(profile.selected_tea_id) if profile.selected_tea_id else None,
        "teaCandidates": candidates,
        "quoteCandidates": quotes,
        "passport": {"items": [passport_response(entry, db) for entry in entries]},
        "share": _share_state(_profile_share(db, user_id)),
    }


def _validate_public_blocks(
    profile: TeaProfile,
    quote: DrinkFeedback | None,
    passport_entries: list[PassportEntry],
) -> None:
    complete = _block_completeness(profile, quote, passport_entries)
    incomplete = [
        block_id for block_id in _normalized_blocks(profile.public_block_ids or [])
        if not complete[block_id]
    ]
    if incomplete:
        raise ProfileError(
            409,
            "PROFILE_BLOCK_INCOMPLETE",
            "请先补全准备公开的 Profile Block",
            {"blockIds": incomplete},
        )


def update_profile(
    db: Session,
    user_id: str,
    *,
    client_event_id: str,
    display_name: str,
    bio: str,
    selected_tea_id: str | None,
    source_feedback_id: str | None,
    public_quote: str | None,
    public_block_ids: list[str],
) -> dict[str, Any]:
    profile = get_or_create_tea_profile(db, user_id)
    if _event_exists(db, user_id, client_event_id):
        return {"accepted": False, "profile": private_profile_response(db, user_id)}

    clean_name = display_name.strip()
    clean_bio = bio.strip()
    if not 2 <= len(clean_name) <= 24 or len(clean_bio) > 80:
        raise ProfileError(422, "VALIDATION_ERROR", "昵称或简介长度不符合契约")

    eligible_ids = {candidate["tea"]["teaId"] for candidate in _eligible_tea_candidates(db, user_id)}
    if selected_tea_id is not None and selected_tea_id not in eligible_ids:
        raise ProfileError(409, "PROFILE_TEA_NOT_ELIGIBLE", "本命茶必须来自你的真实行为记录")

    quote: DrinkFeedback | None = None
    clean_quote: str | None = None
    if source_feedback_id is not None:
        quote = db.get(DrinkFeedback, source_feedback_id)
        if (
            quote is None
            or quote.user_id != user_id
            or not quote.user_words
            or not quote.user_words.strip()
        ):
            raise ProfileError(409, "PROFILE_QUOTE_NOT_OWNED", "这条原话不属于当前用户")
        clean_quote = (public_quote.strip() if public_quote is not None else quote.user_words.strip())
        if not clean_quote:
            raise ProfileError(409, "PROFILE_BLOCK_INCOMPLETE", "公开原话不能为空", {"blockIds": ["MY_WORDS"]})
        clean_quote = clean_quote[:120]
    elif public_quote and public_quote.strip():
        raise ProfileError(409, "PROFILE_QUOTE_NOT_OWNED", "公开原话必须保留真实反馈来源")

    previous = {
        "displayName": profile.display_name,
        "bio": profile.bio,
        "selectedTeaId": profile.selected_tea_id,
        "sourceFeedbackId": profile.source_feedback_id,
        "publicQuote": profile.public_quote,
        "publicBlockIds": list(profile.public_block_ids or []),
    }
    profile.display_name = clean_name
    profile.bio = clean_bio
    profile.selected_tea_id = selected_tea_id
    profile.source_feedback_id = source_feedback_id
    profile.public_quote = clean_quote
    profile.public_block_ids = _normalized_blocks(public_block_ids)
    profile.updated_at = utcnow()

    entries = _passport_entries(db, user_id)
    _validate_public_blocks(profile, quote, entries)
    changed_fields = [
        key for key, value in {
            "displayName": profile.display_name,
            "bio": profile.bio,
            "selectedTeaId": profile.selected_tea_id,
            "sourceFeedbackId": profile.source_feedback_id,
            "publicQuote": profile.public_quote,
            "publicBlockIds": profile.public_block_ids,
        }.items()
        if previous[key] != value
    ]
    record_profile_event(db, user_id, client_event_id, "profile_block_edited", {
        "changedFields": changed_fields,
        "publicBlockIds": profile.public_block_ids,
    })
    db.commit()
    return {"accepted": True, "profile": private_profile_response(db, user_id)}


def _public_passport_response(db: Session, entries: list[PassportEntry]) -> dict[str, Any]:
    safe_items: list[dict[str, Any]] = []
    for entry in sorted(entries, key=lambda item: catalog.require_tea(item.tea_id)["name"]):
        private_entry = passport_response(entry, db)
        safe_items.append({
            "tea": private_entry["tea"],
            "saved": private_entry["saved"],
            "brewed": private_entry["brewed"],
            "tasted": private_entry["tasted"],
            "realmUnlocked": private_entry["realmUnlocked"],
            "specimens": [
                {
                    "specimenId": specimen["specimenId"],
                    "realmId": specimen["realmId"],
                    "name": specimen["name"],
                    "description": specimen["description"],
                    "asset": specimen["asset"],
                }
                for specimen in private_entry["specimens"]
            ],
        })
    return {"items": safe_items}


def public_profile_response(db: Session, share: ProfileShare) -> dict[str, Any]:
    if not share.public_id or share.revoked_at is not None:
        raise ProfileError(404, "PUBLIC_PROFILE_NOT_FOUND", "这个分享链接已失效或不存在")
    profile = get_or_create_tea_profile(db, share.user_id)
    quote = _selected_quote(db, profile)
    entries = _passport_entries(db, share.user_id)
    _validate_public_blocks(profile, quote, entries)
    public_blocks = _normalized_blocks(profile.public_block_ids or [])

    words = None
    if "MY_WORDS" in public_blocks and quote and profile.public_quote:
        words = {
            "text": profile.public_quote,
            "tea": catalog.tea_summary(quote.tea_id),
            "normalizedTags": quote.normalized_tags or [],
        }
    private_tea_bti = tea_bti(db, share.user_id)
    public_tea_bti = {
        field: private_tea_bti[field]
        for field in ("state", "code", "personaName", "personaSummary", "formationProgress", "axes", "evidence")
    }
    return {
        "publicId": share.public_id,
        "publicBlockIds": public_blocks,
        "identity": {
            "displayName": profile.display_name,
            "bio": profile.bio,
            "teaBti": public_tea_bti,
        },
        "myTea": (
            catalog.tea_summary(profile.selected_tea_id)
            if "MY_TEA" in public_blocks and profile.selected_tea_id else None
        ),
        "myWords": words,
        "teaPassport": _public_passport_response(db, entries) if "TEA_PASSPORT" in public_blocks else None,
        "updatedAt": as_utc(profile.updated_at),
    }


def require_public_share(db: Session, public_id: str) -> ProfileShare:
    share = db.scalar(select(ProfileShare).where(
        ProfileShare.public_id == public_id,
        ProfileShare.revoked_at.is_(None),
    ))
    if share is None:
        raise ProfileError(404, "PUBLIC_PROFILE_NOT_FOUND", "这个分享链接已失效或不存在")
    return share


def create_profile_share(db: Session, user_id: str, client_event_id: str) -> dict[str, Any]:
    profile = get_or_create_tea_profile(db, user_id)
    share = _profile_share(db, user_id)
    if _event_exists(db, user_id, client_event_id):
        public_profile = public_profile_response(db, share) if share and share.public_id and share.revoked_at is None else None
        return {"accepted": False, "share": _share_state(share), "publicProfile": public_profile}
    _validate_public_blocks(profile, _selected_quote(db, profile), _passport_entries(db, user_id))
    if share and share.public_id and share.revoked_at is None:
        return {"accepted": False, "share": _share_state(share), "publicProfile": public_profile_response(db, share)}

    now = utcnow()
    public_id = secrets.token_urlsafe(18)
    while db.scalar(select(ProfileShare).where(ProfileShare.public_id == public_id)) is not None:
        public_id = secrets.token_urlsafe(18)
    if share is None:
        share = ProfileShare(user_id=user_id)
        db.add(share)
    share.public_id = public_id
    share.created_at = now
    share.revoked_at = None
    share.updated_at = now
    record_profile_event(db, user_id, client_event_id, "tea_profile_shared", {
        "action": "created",
        "publicBlockIds": _normalized_blocks(profile.public_block_ids or []),
    })
    db.commit()
    return {"accepted": True, "share": _share_state(share), "publicProfile": public_profile_response(db, share)}


def revoke_profile_share(db: Session, user_id: str, client_event_id: str) -> dict[str, Any]:
    share = _profile_share(db, user_id)
    if _event_exists(db, user_id, client_event_id):
        return {"accepted": False, "share": _share_state(share), "publicProfile": None}
    accepted = bool(share and share.public_id and share.revoked_at is None)
    if accepted and share:
        share.public_id = None
        share.revoked_at = utcnow()
        share.updated_at = share.revoked_at
    record_profile_event(db, user_id, client_event_id, "tea_profile_shared", {"action": "revoked", "hadActiveLink": accepted})
    db.commit()
    return {"accepted": accepted, "share": _share_state(share), "publicProfile": None}
