import json
import uuid

from app.catalog import catalog


MBTI_CODES = [
    "INFP", "INFJ", "ISFP", "ISFJ", "ENFP", "ENFJ", "ESFP", "ESFJ",
    "INTP", "INTJ", "ISTP", "ISTJ", "ENTP", "ENTJ", "ESTP", "ESTJ",
]


def test_anonymous_session_and_bootstrap(client, auth):
    response = client.get("/api/v1/bootstrap", headers=auth)
    assert response.status_code == 200
    payload = response.json()
    assert payload["mbti"] is None
    assert payload["swipeCount"] == 0
    assert set(payload["tasteProfile"]["vector"].values()) == {0.5}
    assert payload["capabilities"]["voice"] == "mock"


def test_all_mbti_and_skip_return_three_stable_roles(client, auth):
    for code in [*MBTI_CODES, None]:
        response = client.post("/api/v1/onboarding/seed", headers=auth, json={"mbti": code})
        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["role"] for item in items] == ["mirror", "surprise", "contrast"]
        assert len({item["teaId"] for item in items}) == 3
    bootstrap = client.get("/api/v1/bootstrap", headers=auth).json()
    assert set(bootstrap["tasteProfile"]["vector"].values()) == {0.5}
    assert bootstrap["tasteProfile"]["sampleCount"] == 0


def test_blind_feed_does_not_expose_tea_identity(client, auth):
    response = client.get("/api/v1/feed", headers=auth)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 6
    serialized = json.dumps(payload, ensure_ascii=False)
    for forbidden in ["teaId", "都匀毛尖", "湄潭翠芽", "遵义红", "duyun", "meitan", "zunyi"]:
        assert forbidden not in serialized


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
    assert client.get("/api/v1/me/tea-bti", headers=auth).json()["state"] == "forming"
    for index, card in enumerate(cards[:5]):
        client.post("/api/v1/swipes", headers=auth, json={
            "clientEventId": str(uuid.uuid4()), "cardId": card["cardId"], "action": "like" if index < 2 else "skip",
        })
    result = client.get("/api/v1/me/tea-bti", headers=auth).json()
    assert result["state"] == "early"
    assert len(result["code"]) == 4
    assert result["personaName"]


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
