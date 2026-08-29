from __future__ import annotations

import math
import uuid
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .catalog import catalog
from .models import DrinkFeedback, PassportEntry, RealmProgress, RealmSpecimen, SwipeEvent, TasteProfile


DIMENSIONS = ["freshness", "sweetness", "body", "roast", "astringency", "floral", "fruity", "clean", "aftertaste"]
DIMENSION_LABELS = {
    "freshness": "清鲜",
    "sweetness": "甜润",
    "body": "饱满",
    "roast": "焙火",
    "astringency": "涩感",
    "floral": "花香",
    "fruity": "果香",
    "clean": "干净",
    "aftertaste": "回甘绵长",
}
ACTION_WEIGHTS = {"skip": -0.5, "like": 1.0, "save": 1.5}
DRINK_WEIGHTS = {"like": 3.0, "neutral": 0.0, "dislike": -3.0}
ALLOWED_TAGS = ["fresh", "tender_aroma", "floral", "fruity", "sweet", "mellow", "astringent", "clean", "aftertaste_sweetness"]


def get_or_create_profile(db: Session, user_id: str) -> TasteProfile:
    profile = db.get(TasteProfile, user_id)
    if profile is None:
        profile = TasteProfile(user_id=user_id, evidence={dimension: 0.0 for dimension in DIMENSIONS})
        db.add(profile)
        db.flush()
    return profile


def profile_vector(profile: TasteProfile) -> dict[str, float]:
    denominator = max(1.0, profile.absolute_weight)
    return {
        dimension: round(max(0.0, min(1.0, 0.5 + float(profile.evidence.get(dimension, 0.0)) / denominator)), 4)
        for dimension in DIMENSIONS
    }


def profile_response(profile: TasteProfile) -> dict:
    state = "forming" if profile.sample_count < 5 else "early" if profile.sample_count < 16 else "stable"
    return {"vector": profile_vector(profile), "sampleCount": profile.sample_count, "confidenceState": state}


def apply_signal(db: Session, user_id: str, tea_id: str, weight: float) -> TasteProfile:
    profile = get_or_create_profile(db, user_id)
    sensory = catalog.require_tea(tea_id)["sensoryVector"]
    evidence = dict(profile.evidence)
    for dimension in DIMENSIONS:
        evidence[dimension] = float(evidence.get(dimension, 0.0)) + weight * (float(sensory[dimension]) - 0.5)
    profile.evidence = evidence
    profile.absolute_weight += abs(weight)
    profile.sample_count += 1
    db.flush()
    return profile


def record_swipe(db: Session, user_id: str, client_event_id: str, card_id: str, action: str) -> tuple[SwipeEvent, bool, TasteProfile]:
    existing = db.scalar(select(SwipeEvent).where(SwipeEvent.user_id == user_id, SwipeEvent.client_event_id == client_event_id))
    if existing:
        return existing, False, get_or_create_profile(db, user_id)
    card = catalog.require_card(card_id)
    event = SwipeEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        client_event_id=client_event_id,
        card_id=card_id,
        tea_id=card.tea_id,
        action=action,
        weight=ACTION_WEIGHTS[action],
    )
    db.add(event)
    profile = apply_signal(db, user_id, card.tea_id, event.weight)
    db.flush()
    return event, True, profile


def swipe_count(db: Session, user_id: str) -> int:
    return int(db.scalar(select(func.count()).select_from(SwipeEvent).where(SwipeEvent.user_id == user_id)) or 0)


def recommendation(db: Session, user_id: str) -> dict:
    profile = get_or_create_profile(db, user_id)
    vector = profile_vector(profile)
    seen = Counter(db.scalars(select(SwipeEvent.tea_id).where(SwipeEvent.user_id == user_id)).all())
    ranked: list[tuple[float, str]] = []
    for tea_id, tea in catalog.teas.items():
        sensory = tea["sensoryVector"]
        distance = math.sqrt(sum((vector[d] - sensory[d]) ** 2 for d in DIMENSIONS) / len(DIMENSIONS))
        similarity = 1.0 - distance
        exploration = 1.0 / (1.0 + seen[tea_id])
        ranked.append((0.85 * similarity + 0.15 * exploration, tea_id))
    _, tea_id = max(ranked)
    high = sorted(DIMENSIONS, key=lambda d: vector[d], reverse=True)[:2]
    low = sorted(DIMENSIONS, key=lambda d: vector[d])[:1]
    reasons = [f"你停留更多的，是{'、'.join(DIMENSION_LABELS[d] for d in high)}"]
    if vector[low[0]] < 0.46:
        reasons.append(f"遇到{DIMENSION_LABELS[low[0]]}时，你会多想一下")
    return {"tea": catalog.tea_summary(tea_id), "reasons": reasons, "rankLabel": "此刻最合拍"}


def get_or_create_passport(db: Session, user_id: str, tea_id: str) -> PassportEntry:
    entry = db.scalar(select(PassportEntry).where(PassportEntry.user_id == user_id, PassportEntry.tea_id == tea_id))
    if entry is None:
        entry = PassportEntry(id=str(uuid.uuid4()), user_id=user_id, tea_id=tea_id)
        db.add(entry)
        db.flush()
    return entry


def passport_response(entry: PassportEntry, db: Session | None = None) -> dict:
    realm = catalog.realm_for_tea(entry.tea_id)
    progress = None
    specimen_items: list[dict] = []
    if db is not None and realm is not None:
        progress = db.scalar(select(RealmProgress).where(
            RealmProgress.user_id == entry.user_id,
            RealmProgress.realm_id == realm["id"],
        ))
        specimens = db.scalars(select(RealmSpecimen).where(
            RealmSpecimen.user_id == entry.user_id,
            RealmSpecimen.realm_id == realm["id"],
        ).order_by(RealmSpecimen.collected_at)).all()
        for specimen in specimens:
            definition = realm["specimen"]
            specimen_items.append({
                "specimenId": specimen.specimen_id,
                "realmId": specimen.realm_id,
                "name": definition["name"],
                "description": definition["description"],
                "asset": catalog.realm_asset(definition["assetId"]),
                "collectedAt": specimen.collected_at,
            })
    return {
        "tea": catalog.tea_summary(entry.tea_id),
        "saved": entry.saved,
        "brewed": entry.brewed,
        "tasted": entry.tasted,
        "realmUnlocked": entry.realm_unlocked,
        "favoriteInfusion": entry.favorite_infusion,
        "userDescription": entry.user_description,
        "normalizedTags": entry.normalized_tags or [],
        "firstDrunkAt": entry.first_drunk_at,
        "realmCompletedAt": progress.completed_at if progress else None,
        "realmOutcome": progress.latest_outcome if progress else None,
        "specimens": specimen_items,
        "updatedAt": entry.updated_at,
    }


def tea_journey(db: Session, user_id: str, tea_id: str) -> dict:
    """Derive the guided single-tea journey without creating user state."""
    entry = db.scalar(select(PassportEntry).where(
        PassportEntry.user_id == user_id,
        PassportEntry.tea_id == tea_id,
    ))
    realm = catalog.realm_for_tea(tea_id)
    progress = None
    if realm is not None:
        progress = db.scalar(select(RealmProgress).where(
            RealmProgress.user_id == user_id,
            RealmProgress.realm_id == realm["id"],
        ))

    brewed = bool(entry and entry.brewed)
    tasted = bool(entry and entry.tasted)
    realm_completed = bool(progress and progress.completed_at)
    if not brewed:
        next_step = "brew"
    elif not tasted:
        next_step = "taste"
    elif realm is not None and not realm_completed:
        next_step = "realm"
    else:
        next_step = "passport"

    return {
        "teaId": tea_id,
        "brewed": brewed,
        "tasted": tasted,
        "realmId": realm["id"] if realm else None,
        "realmCompleted": realm_completed,
        "nextStep": next_step,
    }


def record_drink_feedback(db: Session, user_id: str, tea_id: str, result: str, user_words: str | None, infusion_number: int | None, tags: list[str] | None = None) -> tuple[TasteProfile, PassportEntry]:
    feedback = DrinkFeedback(
        id=str(uuid.uuid4()), user_id=user_id, tea_id=tea_id, result=result,
        user_words=user_words, normalized_tags=tags or [], infusion_number=infusion_number,
    )
    db.add(feedback)
    profile = apply_signal(db, user_id, tea_id, DRINK_WEIGHTS[result])
    entry = get_or_create_passport(db, user_id, tea_id)
    entry.tasted = True
    entry.first_drunk_at = entry.first_drunk_at or datetime.now(timezone.utc)
    if user_words:
        entry.user_description = user_words
    if tags:
        entry.normalized_tags = tags
    if infusion_number:
        entry.favorite_infusion = infusion_number
    db.flush()
    return profile, entry


def mock_normalize(text: str) -> tuple[list[str], str]:
    rules = {
        "青草": "fresh", "嫩": "tender_aroma", "花": "floral", "果": "fruity",
        "甜": "aftertaste_sweetness", "厚": "mellow", "涩": "astringent", "干净": "clean", "回甘": "aftertaste_sweetness",
    }
    tags = list(dict.fromkeys(value for key, value in rules.items() if key in text)) or ["clean"]
    labels = {
        "fresh": "清鲜感", "tender_aroma": "嫩香", "floral": "花香", "fruity": "果香",
        "aftertaste_sweetness": "回甘", "mellow": "醇和", "astringent": "涩感", "clean": "干净度",
    }
    return tags, "这句话里，浮出来的是" + "、".join(labels[tag] for tag in tags) + "。"


def tea_bti_behavior_evidence(db: Session, user_id: str) -> list[dict]:
    drinks = list(db.scalars(
        select(DrinkFeedback)
        .where(DrinkFeedback.user_id == user_id)
        .order_by(DrinkFeedback.created_at.desc(), DrinkFeedback.id.desc())
    ).all())
    swipes = list(db.scalars(
        select(SwipeEvent)
        .where(SwipeEvent.user_id == user_id)
        .order_by(SwipeEvent.created_at.desc(), SwipeEvent.id.desc())
    ).all())

    selected: list[tuple[str, DrinkFeedback | SwipeEvent]] = []
    selected_ids: set[tuple[str, str]] = set()
    selected_teas: set[str] = set()

    def add(kind: str, event: DrinkFeedback | SwipeEvent, *, require_new_tea: bool) -> bool:
        identity = (kind, event.id)
        if identity in selected_ids or (require_new_tea and event.tea_id in selected_teas):
            return False
        selected.append((kind, event))
        selected_ids.add(identity)
        selected_teas.add(event.tea_id)
        return True

    quoted_drink = next((item for item in drinks if item.user_words and item.user_words.strip()), None)
    if quoted_drink is not None:
        add("drink", quoted_drink, require_new_tea=False)

    positive_swipe = next((item for item in swipes if item.action in {"like", "save"} and item.tea_id not in selected_teas), None)
    if positive_swipe is not None:
        add(positive_swipe.action, positive_swipe, require_new_tea=True)

    skipped_swipe = next((item for item in swipes if item.action == "skip" and item.tea_id not in selected_teas), None)
    if skipped_swipe is not None:
        add("skip", skipped_swipe, require_new_tea=True)

    remaining: list[tuple[datetime, str, DrinkFeedback | SwipeEvent]] = [
        *((item.created_at, "drink", item) for item in drinks),
        *((item.created_at, item.action, item) for item in swipes),
    ]
    remaining.sort(key=lambda item: item[0], reverse=True)
    for _, kind, event in remaining:
        if len(selected) >= 3:
            break
        add(kind, event, require_new_tea=False)

    return [
        {
            "kind": kind,
            "tea": catalog.tea_summary(event.tea_id),
            "userWords": event.user_words if isinstance(event, DrinkFeedback) else None,
            "infusionNumber": event.infusion_number if isinstance(event, DrinkFeedback) else None,
        }
        for kind, event in selected[:3]
    ]


def tea_bti(db: Session, user_id: str) -> dict:
    profile = get_or_create_profile(db, user_id)
    vector = profile_vector(profile)
    swipes = db.scalars(select(SwipeEvent).where(SwipeEvent.user_id == user_id)).all()
    positive_tea_ids = {event.tea_id for event in swipes if event.action in {"like", "save"}}
    drink_count = int(db.scalar(select(func.count()).select_from(DrinkFeedback).where(DrinkFeedback.user_id == user_id)) or 0)
    has_positive = bool(positive_tea_ids) or drink_count > 0
    behavior_evidence = tea_bti_behavior_evidence(db, user_id)
    swipes_required = 2
    axes = {
        "freshMellow": round(vector["freshness"] - (vector["body"] + vector["roast"]) / 2, 4),
        "lightRich": round(0.5 - vector["body"], 4),
        "scentTaste": round((vector["floral"] + vector["fruity"] + vector["freshness"]) / 3 - (vector["sweetness"] + vector["body"] + vector["aftertaste"]) / 3, 4),
        "explorerComfort": 1.0 if len(positive_tea_ids) >= 2 else -1.0,
    }
    if len(swipes) < swipes_required:
        return {
            "state": "forming",
            "code": None,
            "personaName": None,
            "personaSummary": None,
            "formationProgress": {
                "swipesCompleted": len(swipes),
                "swipesRequired": swipes_required,
                "swipesRemaining": max(0, swipes_required - len(swipes)),
                "positiveSignalCompleted": has_positive,
            },
            "personaDetail": None,
            "behaviorEvidence": behavior_evidence,
            "axes": axes,
            "evidence": ["刷满 2 杯后先形成初步轮廓，后续选择会继续校准"],
        }
    code = "".join([
        "F" if axes["freshMellow"] >= 0 else "M",
        "L" if axes["lightRich"] >= 0 else "R",
        "S" if axes["scentTaste"] >= 0 else "T",
        "E" if axes["explorerComfort"] >= 0 else "C",
    ])
    persona = catalog.require_tea_bti_persona(code)
    persona_detail = deepcopy(persona["detail"])
    partner_code = persona_detail["chemistry"]["partnerCode"]
    persona_detail["chemistry"]["partnerName"] = catalog.require_tea_bti_persona(partner_code)["name"]
    state = "stable" if profile.sample_count >= 16 else "early"
    return {
        "state": state,
        "code": code,
        "personaName": persona["name"],
        "personaSummary": persona["summary"],
        "formationProgress": None,
        "personaDetail": persona_detail,
        "behaviorEvidence": behavior_evidence,
        "axes": axes,
        "evidence": [f"已完成 {len(swipes)} 次刷茶", f"留下了 {len(positive_tea_ids)} 款不同的茶"],
    }
