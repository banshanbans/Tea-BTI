import json
import re
import uuid

import pytest

from app.catalog import catalog


MBTI_CODES = [
    "INFP", "INFJ", "ISFP", "ISFJ", "ENFP", "ENFJ", "ESFP", "ESFJ",
    "INTP", "INTJ", "ISTP", "ISTJ", "ENTP", "ENTJ", "ESTP", "ESTJ",
]

TEA_BTI_PERSONAS = [
    ("FLSE", "山雾漫游者", "清鲜、轻盈，追着香气认识新茶"),
    ("FLSC", "春庭守香人", "清鲜、轻盈，偏爱熟悉舒服的香"),
    ("FLTE", "清溪寻味者", "清鲜、轻盈，喜欢探索细微滋味"),
    ("FLTC", "白露慢饮者", "清鲜、轻盈，找到喜欢的便慢慢喝"),
    ("FRSE", "花岭猎香者", "清鲜但有厚度，喜欢追逐强烈香气"),
    ("FRSC", "兰室藏香人", "清鲜浓郁，偏爱稳定而有层次的香"),
    ("FRTE", "青岚探味者", "清鲜饱满，喜欢挑战不同滋味结构"),
    ("FRTC", "松间守味人", "清鲜饱满，偏爱有存在感的熟悉滋味"),
    ("MLSE", "暮野寻香者", "温润轻盈，在柔和茶里不断寻找新香"),
    ("MLSC", "暖庭藏香人", "温润轻盈，喜欢熟悉、安静的香气"),
    ("MLTE", "秋溪探味者", "温润轻盈，更关注入口与回味变化"),
    ("MLTC", "暖盏慢饮者", "温润轻盈，一杯喜欢的茶可以喝很久"),
    ("MRSE", "烟霞猎香者", "醇和浓郁，喜欢大胆探索厚重香气"),
    ("MRSC", "炉火守香人", "醇和浓郁，对熟悉的深香有稳定偏爱"),
    ("MRTE", "深山探味者", "醇厚浓郁，专注复杂滋味和长尾韵"),
    ("MRTC", "炉火守夜人", "醇厚浓郁，偏爱稳定、深沉、耐喝的茶"),
]


@pytest.mark.parametrize(("code", "name", "summary"), TEA_BTI_PERSONAS)
def test_all_tea_bti_personas_are_reviewed_and_exact(code, name, summary):
    persona = catalog.require_tea_bti_persona(code)
    assert {field: persona[field] for field in ("code", "name", "summary")} == {"code": code, "name": name, "summary": summary}


def test_all_tea_bti_persona_details_have_fixed_shapes_safe_copy_and_mutual_cp():
    for code, _, _ in TEA_BTI_PERSONAS:
        detail = catalog.require_tea_bti_persona(code)["detail"]
        assert len(detail["symptoms"]) == 5
        assert len(detail["contrasts"]) == 4
        assert len(detail["scenes"]) == 3
        assert len(detail["enemies"]) == 3
        assert len(detail["signatureMoment"]) >= 2
        partner_code = detail["chemistry"]["partnerCode"]
        assert partner_code != code
        assert catalog.require_tea_bti_persona(partner_code)["detail"]["chemistry"]["partnerCode"] == code
        searchable = json.dumps(detail, ensure_ascii=False)
        assert not re.search(r"不是.{0,120}而是|天生如此|匹配度|\d+(?:\.\d+)?%|确诊|病症|停留\s*\d+\s*秒|过去\s*\d+\s*杯|跳过了\s*\d+\s*杯|出现了?\s*\d+\s*次", searchable)


def test_anonymous_session_and_bootstrap(client, auth):
    response = client.get("/api/v1/bootstrap", headers=auth)
    assert response.status_code == 200
    payload = response.json()
    assert payload["mbti"] is None
    assert payload["swipeCount"] == 0
    assert set(payload["tasteProfile"]["vector"].values()) == {0.5}
    assert payload["capabilities"]["voice"] == "mock"


def test_all_mbti_and_skip_return_three_stable_roles(client, auth):
    primary_counts = {tea_id: 0 for tea_id in catalog.teas}
    for code in [*MBTI_CODES, None]:
        response = client.post("/api/v1/onboarding/seed", headers=auth, json={"mbti": code})
        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["role"] for item in items] == ["mirror", "surprise", "contrast"]
        assert len({item["teaId"] for item in items}) == 3
        assert all(item["personalityKeywords"] for item in items)
        if code is not None:
            primary_counts[items[0]["teaId"]] += 1
    assert set(primary_counts.values()) == {2}
    bootstrap = client.get("/api/v1/bootstrap", headers=auth).json()
    assert set(bootstrap["tasteProfile"]["vector"].values()) == {0.5}
    assert bootstrap["tasteProfile"]["sampleCount"] == 0


def test_mbti_seed_mapping_and_skip_fallback_are_exact(client, auth):
    expected = {
        "ENFP": ["duyun-maojian", "fanjingshan-matcha", "meitan-cuiya"],
        "ENTP": ["duyun-maojian", "fanjingshan-matcha", "fenggang-xinxi"],
        "INTJ": ["meitan-cuiya", "fanjingshan-matcha", "puan-hong"],
        "ISTJ": ["meitan-cuiya", "lvbaoshi", "duyun-maojian"],
        "ISTP": ["lvbaoshi", "duyun-maojian", "puan-hong"],
        "ESTJ": ["lvbaoshi", "zunyi-hong", "leishan-yinqiu"],
        "INFJ": ["puan-hong", "leishan-yinqiu", "zunyi-hong"],
        "ENFJ": ["puan-hong", "zunyi-hong", "meitan-cuiya"],
        "ISFJ": ["fenggang-xinxi", "puan-hong", "fanjingshan-matcha"],
        "ESFJ": ["fenggang-xinxi", "zunyi-hong", "fanjingshan-matcha"],
        "ENTJ": ["zunyi-hong", "meitan-cuiya", "leishan-yinqiu"],
        "ESTP": ["zunyi-hong", "fanjingshan-matcha", "leishan-yinqiu"],
        "INFP": ["leishan-yinqiu", "puan-hong", "zunyi-hong"],
        "ISFP": ["leishan-yinqiu", "duyun-maojian", "meitan-cuiya"],
        "INTP": ["fanjingshan-matcha", "duyun-maojian", "fenggang-xinxi"],
        "ESFP": ["fanjingshan-matcha", "zunyi-hong", "meitan-cuiya"],
    }
    for code, tea_ids in expected.items():
        items = client.post("/api/v1/onboarding/seed", headers=auth, json={"mbti": code}).json()["items"]
        assert [item["teaId"] for item in items] == tea_ids
        assert all(any(word in item["explanation"] for word in ("可能", "也许", "此刻", "先试试")) for item in items)
    fallback = client.post("/api/v1/onboarding/seed", headers=auth, json={"mbti": None}).json()["items"]
    assert [item["teaId"] for item in fallback] == ["duyun-maojian", "puan-hong", "fanjingshan-matcha"]


def test_feed_exposes_all_eight_tea_identities_with_presentation_visuals(client, auth):
    response = client.get("/api/v1/feed", headers=auth)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 8
    assert {item["teaId"] for item in payload["items"]} == set(catalog.teas)
    assert all(item["name"] and item["personalityKeywords"] for item in payload["items"])
    assert all("presentation" in item["visual"]["url"] or item["visual"]["url"].startswith("/api/v1/media/cards/card_") for item in payload["items"])


def test_five_new_sensory_vectors_are_complete_bounded_and_exact():
    expected = {
        "lvbaoshi": (.80, .65, .64, .18, .25, .35, .18, .80, .82),
        "puan-hong": (.48, .80, .76, .30, .24, .64, .72, .74, .80),
        "fenggang-xinxi": (.82, .64, .58, .18, .23, .54, .18, .86, .76),
        "leishan-yinqiu": (.76, .63, .50, .16, .22, .42, .16, .82, .72),
        "fanjingshan-matcha": (.86, .35, .70, .06, .40, .18, .10, .78, .60),
    }
    dimensions = ("freshness", "sweetness", "body", "roast", "astringency", "floral", "fruity", "clean", "aftertaste")
    for tea_id, values in expected.items():
        vector = catalog.require_tea(tea_id)["sensoryVector"]
        assert set(vector) == set(dimensions)
        assert tuple(vector[dimension] for dimension in dimensions) == values
        assert all(0 <= value <= 1 for value in vector.values())


@pytest.mark.parametrize(("tea_sequence", "like_mask", "expected_tea_id"), [
    (["duyun-maojian", "meitan-cuiya", "lvbaoshi", "puan-hong", "fenggang-xinxi"], 0, "zunyi-hong"),
    (["duyun-maojian", "meitan-cuiya", "lvbaoshi", "puan-hong", "fenggang-xinxi"], 3, "leishan-yinqiu"),
    (["duyun-maojian", "meitan-cuiya", "lvbaoshi", "puan-hong", "leishan-yinqiu"], 3, "fenggang-xinxi"),
    (["duyun-maojian", "meitan-cuiya", "lvbaoshi", "fenggang-xinxi", "zunyi-hong"], 0, "puan-hong"),
    (["duyun-maojian", "meitan-cuiya", "lvbaoshi", "fenggang-xinxi", "leishan-yinqiu"], 11, "meitan-cuiya"),
    (["duyun-maojian", "meitan-cuiya", "puan-hong", "fenggang-xinxi", "leishan-yinqiu"], 3, "lvbaoshi"),
    (["duyun-maojian", "meitan-cuiya", "puan-hong", "zunyi-hong", "leishan-yinqiu"], 0, "fanjingshan-matcha"),
    (["meitan-cuiya", "lvbaoshi", "puan-hong", "fenggang-xinxi", "leishan-yinqiu"], 11, "duyun-maojian"),
])
def test_five_swipes_can_cover_every_tea_in_recommendation_pool(client, auth, tea_sequence, like_mask, expected_tea_id):
    cards = {item["teaId"]: item for item in client.get("/api/v1/feed", headers=auth).json()["items"]}
    final = None
    for index, tea_id in enumerate(tea_sequence):
        final = client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"coverage-{index}",
            "cardId": cards[tea_id]["cardId"],
            "action": "like" if like_mask & (1 << index) else "skip",
        })
    assert final is not None
    assert final.json()["recommendationReady"] is True
    assert final.json()["recommendation"]["tea"]["teaId"] == expected_tea_id


def test_legacy_card_ids_remain_resolvable_but_inactive(client, auth):
    legacy = {record.asset["id"]: record for record in catalog.cards.values() if not record.active}
    assert {
        "duyun-maojian-mist-cup", "duyun-maojian-pour-ripple",
        "meitan-cuiya-spring-pour", "meitan-cuiya-clear-infusion",
        "zunyi-hong-amber-table", "zunyi-hong-red-bright-cup",
    } <= set(legacy)
    assert {legacy[asset_id].tea_id for asset_id in legacy} == {"duyun-maojian", "meitan-cuiya", "zunyi-hong"}
    historical = legacy["duyun-maojian-mist-cup"]
    response = client.post("/api/v1/swipes", headers=auth, json={
        "clientEventId": "historical-card-event", "cardId": historical.card_id, "action": "save",
    })
    assert response.status_code == 200
    assert response.json()["accepted"] is True
    assert all(item["cardId"] != historical.card_id for item in client.get("/api/v1/feed", headers=auth).json()["items"])


def test_all_tea_details_have_documentary_visuals_and_structured_content(client, auth):
    for tea_id in catalog.teas:
        response = client.get(f"/api/v1/teas/{tea_id}", headers=auth)
        assert response.status_code == 200
        detail = response.json()
        assert detail["detailVisual"]["url"] == f"/api/v1/media/details/{tea_id}"
        assert detail["detailVisual"]["rightsState"] == "unknown"
        assert detail["representativeFeatures"]
        assert detail["aromaAndTaste"]
        assert len(detail["personalityKeywords"]) == 3
        assert detail["brewingGuide"]["teaAmount"]
        assert detail["brewingGuide"]["waterVolume"]
        assert detail["brewingGuide"]["method"]
        assert detail["evidenceRefs"]


def test_swipe_is_idempotent_and_fifth_swipe_recommends(client, auth):
    cards = client.get("/api/v1/feed", headers=auth).json()["items"]
    final = None
    for index, card in enumerate(cards[:5]):
        action = "like" if index in {0, 2} else "skip"
        final = client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"event-{index}", "cardId": card["cardId"], "action": action,
        })
        assert final.status_code == 200
        assert final.json()["accepted"] is True
    assert final.json()["recommendationReady"] is True
    assert final.json()["recommendation"]["tea"]["teaId"]
    duplicate = client.post("/api/v1/swipes", headers=auth, json={
        "clientEventId": "event-4", "cardId": cards[4]["cardId"], "action": "skip",
    })
    assert duplicate.json()["accepted"] is False
    assert client.get("/api/v1/bootstrap", headers=auth).json()["swipeCount"] == 5


def test_tea_bti_requires_five_swipes_and_positive_signal(client, auth):
    cards = client.get("/api/v1/feed", headers=auth).json()["items"]
    forming = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert forming["state"] == "forming"
    assert forming["code"] is None
    assert forming["personaName"] is None
    assert forming["personaSummary"] is None
    assert forming["personaDetail"] is None
    assert forming["behaviorEvidence"] == []
    assert forming["formationProgress"] == {
        "swipesCompleted": 0,
        "swipesRequired": 5,
        "swipesRemaining": 5,
        "positiveSignalCompleted": False,
    }
    for index, card in enumerate(cards[:5]):
        client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": str(uuid.uuid4()), "cardId": card["cardId"], "action": "like" if index < 2 else "skip",
        })
    result = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert result["state"] == "early"
    assert len(result["code"]) == 4
    persona = catalog.require_tea_bti_persona(result["code"])
    assert result["personaName"] == persona["name"]
    assert result["personaSummary"] == persona["summary"]
    assert result["formationProgress"] is None
    assert result["personaDetail"]["punchline"] == persona["detail"]["punchline"]
    partner_code = persona["detail"]["chemistry"]["partnerCode"]
    assert result["personaDetail"]["chemistry"]["partnerName"] == catalog.require_tea_bti_persona(partner_code)["name"]
    assert len(result["behaviorEvidence"]) == 3


def test_tea_bti_behavior_evidence_prioritizes_real_words_positive_and_skip(client, auth):
    cards = client.get("/api/v1/feed", headers=auth).json()["items"]
    by_tea = {card["teaId"]: card for card in cards}
    signals = [
        ("duyun-maojian", "like"),
        ("meitan-cuiya", "skip"),
        ("fanjingshan-matcha", "save"),
        ("zunyi-hong", "skip"),
        ("lvbaoshi", "like"),
    ]
    for tea_id, action in signals:
        response = client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"evidence-{tea_id}", "cardId": by_tea[tea_id]["cardId"], "action": action,
        })
        assert response.status_code == 200
    tasted = client.post("/api/v1/taste/normalize", headers=auth, json={
        "teaId": "puan-hong", "text": "入口温润，后面有一点甜", "infusionNumber": 3,
    })
    assert tasted.status_code == 200

    evidence = client.get("/api/v1/me/tea-bti", headers=auth).json()["behaviorEvidence"]
    assert len(evidence) == 3
    assert evidence[0]["kind"] == "drink"
    assert evidence[0]["tea"]["teaId"] == "puan-hong"
    assert evidence[0]["userWords"] == "入口温润，后面有一点甜"
    assert evidence[0]["infusionNumber"] == 3
    assert evidence[1]["kind"] in {"like", "save"}
    assert evidence[2]["kind"] == "skip"
    assert len({item["tea"]["teaId"] for item in evidence}) == 3


def test_tea_bti_formation_progress_tracks_both_requirements(client, auth):
    cards = client.get("/api/v1/feed", headers=auth).json()["items"]
    for index, card in enumerate(cards[:3]):
        client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"forming-skip-{index}", "cardId": card["cardId"], "action": "skip",
        })
    partial = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert partial["formationProgress"] == {
        "swipesCompleted": 3,
        "swipesRequired": 5,
        "swipesRemaining": 2,
        "positiveSignalCompleted": False,
    }

    for index, card in enumerate(cards[3:5], start=3):
        client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"forming-skip-{index}", "cardId": card["cardId"], "action": "skip",
        })
    no_positive = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert no_positive["state"] == "forming"
    assert no_positive["formationProgress"]["swipesRemaining"] == 0
    assert no_positive["formationProgress"]["positiveSignalCompleted"] is False

    client.post("/api/v1/taste/normalize", headers=auth, json={
        "teaId": "duyun-maojian", "text": "清鲜，喝完有一点回甘", "infusionNumber": 2,
    })
    formed = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert formed["state"] == "early"
    assert formed["formationProgress"] is None


@pytest.mark.parametrize("swipe_count", range(6))
def test_tea_bti_formation_progress_counts_every_swipe_from_zero_through_five(client, auth, swipe_count):
    cards = client.get("/api/v1/feed", headers=auth).json()["items"]
    for index, card in enumerate(cards[:swipe_count]):
        response = client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": f"progress-{swipe_count}-{index}", "cardId": card["cardId"], "action": "skip",
        })
        assert response.status_code == 200
    tea_bti = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert tea_bti["state"] == "forming"
    assert tea_bti["formationProgress"] == {
        "swipesCompleted": swipe_count,
        "swipesRequired": 5,
        "swipesRemaining": 5 - swipe_count,
        "positiveSignalCompleted": False,
    }


def test_taste_normalize_updates_passport_in_mock_mode(client, auth):
    response = client.post("/api/v1/taste/normalize", headers=auth, json={
        "teaId": "duyun-maojian", "text": "有点像青草，喝完还有一点甜", "infusionNumber": 2,
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["providerMode"] == "server_mock"
    assert "fresh" in payload["normalizedTags"]
    passport = client.get("/api/v1/me/passport", headers=auth).json()["items"]
    assert passport[0]["tasted"] is True
    assert passport[0]["favoriteInfusion"] == 2


def test_mock_voice_lifecycle_and_turn_deduplication(client, auth):
    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"})
    assert created.status_code == 201
    session_id = created.json()["voiceSessionId"]
    assert created.json()["providerMode"] == "browser_mock"
    started = client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    assert started.json()["status"] == "active"
    turns = {"turns": [{"clientTurnId": "turn-1", "role": "user", "text": "像青草，后面有点甜"}]}
    assert client.post(f"/api/v1/voice/sessions/{session_id}/turns", headers=auth, json=turns).json()["acceptedCount"] == 1
    assert client.post(f"/api/v1/voice/sessions/{session_id}/turns", headers=auth, json=turns).json()["acceptedCount"] == 0
    stopped = client.post(f"/api/v1/voice/sessions/{session_id}/stop", headers=auth, json={"saveUserText": "像青草，后面有点甜", "infusionNumber": 2})
    assert stopped.status_code == 200
    assert stopped.json()["status"] == "completed"
    assert stopped.json()["experienceCompleted"] is True
    assert stopped.json()["journey"]["nextStep"] == "brew"
    assert stopped.json()["tasteResult"]["providerMode"] == "server_mock"


def test_only_one_live_voice_session_is_allowed_per_user(client, auth):
    first = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"})
    second = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"})
    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "VOICE_SESSION_ACTIVE"
    assert second.json()["error"]["details"]["voiceSessionId"] == first.json()["voiceSessionId"]


def test_real_voice_stop_is_retryable_after_provider_network_failure(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.models import VoiceSession
    from app.voice import ProviderError

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, session_id)
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-retry"
        voice_session.task_id = "task-retry"
        db.commit()

    async def fail_stop(**_kwargs):
        raise ProviderError("offline")

    monkeypatch.setattr("app.main.voice_provider.stop", fail_stop)
    failed = client.post(f"/api/v1/voice/sessions/{session_id}/stop", headers=auth, json={})
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "VOICE_STOP_FAILED"
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, session_id)
        assert voice_session.status == "stopping"
        assert voice_session.action_lease_token is None
        assert voice_session.action_lease_until is None

    async def successful_stop(**_kwargs):
        return None

    monkeypatch.setattr("app.main.voice_provider.stop", successful_stop)
    retried = client.post(f"/api/v1/voice/sessions/{session_id}/stop", headers=auth, json={})
    assert retried.status_code == 200
    assert retried.json()["status"] == "completed"


def test_real_voice_start_transport_failure_stays_uncertain_without_mock_fallback(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.models import VoiceSession
    from app.voice import ProviderError

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-start-unknown"
        voice_session.task_id = "task-start-unknown"
        db.commit()

    async def uncertain_start(**_kwargs):
        raise ProviderError("timeout", kind="unknown", code="ReadTimeout")

    monkeypatch.setattr("app.main.voice_provider.start", uncertain_start)
    response = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "VOICE_START_UNCERTAIN"
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        assert voice_session.status == "starting"
        assert voice_session.provider_mode == "volcengine_rtc"
        assert voice_session.last_provider_error_code == "ReadTimeout"


def test_real_voice_explicit_start_failure_never_falls_back(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.models import VoiceSession
    from app.voice import ProviderError

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-start-rejected"
        voice_session.task_id = "task-start-rejected"
        db.commit()

    async def rejected_start(**_kwargs):
        raise ProviderError("rejected", code="InvalidConfig", request_id="request-safe")

    monkeypatch.setattr("app.main.voice_provider.start", rejected_start)
    response = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "VOICE_PROVIDER_UNAVAILABLE"
    assert response.json()["error"]["details"]["providerRequestId"] == "request-safe"
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        assert voice_session.status == "failed"
        assert voice_session.provider_mode == "volcengine_rtc"


def test_abort_is_idempotent_and_does_not_complete_business_journey(client, auth):
    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    client.patch(
        f"/api/v1/voice/sessions/{created['voiceSessionId']}/context",
        headers=auth,
        json={"brewStage": "complete", "infusionNumber": 3},
    )
    first = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/abort", headers=auth)
    second = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/abort", headers=auth)
    assert first.json() == second.json() == {"status": "cancelled"}
    journey = client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["journey"]
    assert journey["brewed"] is False


def test_completed_voice_stop_returns_the_same_persisted_result(client, auth):
    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    first = client.post(
        f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop",
        headers=auth,
        json={"saveUserText": "第二泡更甜", "infusionNumber": 2},
    )
    second = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop", headers=auth, json={})
    assert second.json() == first.json()


def test_local_completion_retry_does_not_stop_remote_provider_twice(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.main import ApiError, normalize_and_save as real_normalize_and_save
    from app.models import VoiceSession, utcnow

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-once"
        voice_session.task_id = "task-once"
        voice_session.provider_started_at = utcnow()
        db.commit()

    stops = []

    async def successful_stop(**kwargs):
        stops.append(kwargs)

    async def fail_local_save(*_args, **_kwargs):
        raise ApiError(503, "TASTE_PROVIDER_UNAVAILABLE", "retry", retryable=True)

    monkeypatch.setattr("app.main.voice_provider.stop", successful_stop)
    monkeypatch.setattr("app.main.normalize_and_save", fail_local_save)
    failed = client.post(
        f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop",
        headers=auth,
        json={"saveUserText": "第二泡更甜", "infusionNumber": 2},
    )
    assert failed.status_code == 503
    monkeypatch.setattr("app.main.normalize_and_save", real_normalize_and_save)
    retried = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop", headers=auth, json={})
    assert retried.status_code == 200
    assert stops == [{"room_id": "room-once", "task_id": "task-once"}]


def test_voice_action_lease_prevents_duplicate_remote_stop(client, auth, monkeypatch):
    from datetime import timedelta

    from app.db import SessionLocal
    from app.models import VoiceSession, utcnow

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-leased"
        voice_session.task_id = "task-leased"
        voice_session.provider_started_at = utcnow()
        voice_session.action_lease_token = "another-worker"
        voice_session.action_lease_until = utcnow() + timedelta(seconds=20)
        db.commit()

    calls = []

    async def should_not_run(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("app.main.voice_provider.stop", should_not_run)
    response = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop", headers=auth, json={})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VOICE_SESSION_BUSY"
    assert calls == []


def test_terminal_remote_stop_error_is_treated_as_stopped(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.models import VoiceSession, utcnow
    from app.voice import ProviderError

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/start", headers=auth)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-absent"
        voice_session.task_id = "task-absent"
        voice_session.provider_started_at = utcnow()
        db.commit()

    async def absent_stop(**_kwargs):
        raise ProviderError("task not found", kind="terminal", code="TaskNotFound")

    monkeypatch.setattr("app.main.voice_provider.stop", absent_stop)
    response = client.post(f"/api/v1/voice/sessions/{created['voiceSessionId']}/stop", headers=auth, json={})
    assert response.status_code == 200
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, created["voiceSessionId"])
        assert voice_session.provider_stopped_at is not None


def test_expired_real_voice_session_stops_remote_task(client, auth, monkeypatch):
    import asyncio
    from datetime import timedelta

    from app.db import SessionLocal
    from app.main import expire_voice_sessions
    from app.models import VoiceSession, utcnow

    created = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    session_id = created["voiceSessionId"]
    stopped = []

    async def successful_stop(**kwargs):
        stopped.append(kwargs)

    monkeypatch.setattr("app.main.voice_provider.stop", successful_stop)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, session_id)
        voice_session.status = "active"
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "room-expired"
        voice_session.task_id = "task-expired"
        voice_session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
        asyncio.run(expire_voice_sessions(db))
        db.commit()
        assert voice_session.status == "expired"

    assert stopped == [{"room_id": "room-expired", "task_id": "task-expired"}]


def test_tea_journey_is_server_derived_and_skips_missing_realm(client, auth):
    initial = client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["journey"]
    assert initial == {
        "teaId": "duyun-maojian",
        "brewed": False,
        "tasted": False,
        "realmId": "duyun-maojian-mist-bud",
        "realmCompleted": False,
        "nextStep": "brew",
    }

    client.put("/api/v1/me/passport/duyun-maojian", headers=auth, json={"brewed": True})
    assert client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["journey"]["nextStep"] == "taste"
    client.put("/api/v1/me/passport/duyun-maojian", headers=auth, json={"tasted": True})
    assert client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["journey"]["nextStep"] == "realm"

    client.put("/api/v1/me/passport/meitan-cuiya", headers=auth, json={"brewed": True, "tasted": True})
    no_realm = client.get("/api/v1/teas/meitan-cuiya", headers=auth).json()["journey"]
    assert no_realm["realmId"] is None
    assert no_realm["nextStep"] == "passport"


def test_voice_stop_only_records_explicit_brew_completion_and_confirmed_taste(client, auth):
    early = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{early['voiceSessionId']}/start", headers=auth)
    early_stop = client.post(f"/api/v1/voice/sessions/{early['voiceSessionId']}/stop", headers=auth, json={}).json()
    assert early_stop["experienceCompleted"] is False
    assert early_stop["journey"]["brewed"] is False
    assert early_stop["journey"]["nextStep"] == "brew"

    completed = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "brew", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{completed['voiceSessionId']}/start", headers=auth)
    client.patch(f"/api/v1/voice/sessions/{completed['voiceSessionId']}/context", headers=auth, json={"brewStage": "complete"})
    completed_stop = client.post(f"/api/v1/voice/sessions/{completed['voiceSessionId']}/stop", headers=auth, json={}).json()
    assert completed_stop["experienceCompleted"] is True
    assert completed_stop["journey"]["nextStep"] == "taste"

    taste = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{taste['voiceSessionId']}/start", headers=auth)
    no_words = client.post(f"/api/v1/voice/sessions/{taste['voiceSessionId']}/stop", headers=auth, json={}).json()
    assert no_words["experienceCompleted"] is False
    assert no_words["journey"]["tasted"] is False
    assert no_words["journey"]["nextStep"] == "taste"

    persisted = client.post("/api/v1/voice/sessions", headers=auth, json={"mode": "taste", "teaId": "duyun-maojian"}).json()
    client.post(f"/api/v1/voice/sessions/{persisted['voiceSessionId']}/start", headers=auth)
    client.post(f"/api/v1/voice/sessions/{persisted['voiceSessionId']}/turns", headers=auth, json={
        "turns": [{"clientTurnId": "taste-final-turn", "role": "user", "text": "入口清鲜，后面有一点甜"}],
    })
    persisted_stop = client.post(f"/api/v1/voice/sessions/{persisted['voiceSessionId']}/stop", headers=auth, json={}).json()
    assert persisted_stop["experienceCompleted"] is True
    assert persisted_stop["journey"]["tasted"] is True
    assert persisted_stop["journey"]["nextStep"] == "realm"


def test_errors_use_contract_envelope(client):
    response = client.get("/api/v1/bootstrap")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"
    assert response.json()["error"]["requestId"]


def test_action_weights_use_centered_evidence_and_stay_normalized(client, auth):
    card_id, record = next(iter(catalog.cards.items()))
    sensory = catalog.require_tea(record.tea_id)["sensoryVector"]
    liked = client.post("/api/v1/swipes", headers=auth, json={
        "clientEventId": "weighted-like", "cardId": card_id, "action": "like",
    }).json()["tasteProfile"]["vector"]
    for dimension, value in sensory.items():
        assert liked[dimension] == round(value, 4)
        assert 0 <= liked[dimension] <= 1


def test_passport_partial_update_round_trip(client, auth):
    response = client.put("/api/v1/me/passport/duyun-maojian", headers=auth, json={
        "saved": True, "brewed": True, "favoriteInfusion": 3,
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["saved"] is True
    assert payload["brewed"] is True
    assert payload["favoriteInfusion"] == 3
    assert payload["firstDrunkAt"] is not None
