import copy
import json


def create_auth(client):
    token = client.post("/api/v1/sessions/anonymous").json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def create_profile_evidence(client, auth):
    card = client.get("/api/v1/feed", headers=auth).json()["items"][0]
    swipe = client.post("/api/v1/swipes", headers=auth, json={
        "clientEventId": "profile-swipe",
        "cardId": card["cardId"],
        "action": "like",
    }).json()
    tea_id = swipe["reveal"]["teaId"]
    client.post("/api/v1/taste/normalize", headers=auth, json={
        "teaId": tea_id,
        "text": "像雨后刚打开的窗，清清的，尾巴有一点甜",
        "infusionNumber": 2,
    })
    profile = client.get("/api/v1/me/profile", headers=auth).json()
    return tea_id, profile["quoteCandidates"][0]["feedbackId"]


def update_payload(tea_id, feedback_id, **overrides):
    return {
        "clientEventId": "profile-update",
        "displayName": "山边喝茶的人",
        "bio": "在清鲜和回甘之间，慢慢找到自己的这一杯。",
        "selectedTeaId": tea_id,
        "sourceFeedbackId": feedback_id,
        "publicQuote": "像雨后刚打开的窗，尾巴有一点甜。",
        "publicBlockIds": ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"],
        **overrides,
    }


def test_profile_defaults_private_and_aggregates_only_real_candidates(client, auth):
    initial = client.get("/api/v1/me/profile", headers=auth)
    assert initial.status_code == 200
    payload = initial.json()
    assert payload["settings"]["displayName"] == "一位喝茶的人"
    assert payload["settings"]["publicBlockIds"] == ["IDENTITY"]
    assert payload["teaCandidates"] == []
    assert payload["quoteCandidates"] == []
    assert payload["share"]["active"] is False
    assert [block["blockId"] for block in payload["blocks"]] == [
        "IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT",
    ]

    tea_id, feedback_id = create_profile_evidence(client, auth)
    enriched = client.get("/api/v1/me/profile", headers=auth).json()
    assert {item["tea"]["teaId"] for item in enriched["teaCandidates"]} == {tea_id}
    assert enriched["quoteCandidates"][0]["feedbackId"] == feedback_id
    assert enriched["quoteCandidates"][0]["text"].startswith("像雨后")
    assert enriched["passport"]["items"][0]["tasted"] is True


def test_profile_rejects_ineligible_tea_and_foreign_quote(client, auth):
    response = client.put("/api/v1/me/profile", headers=auth, json={
        "clientEventId": "invalid-tea",
        "displayName": "一位喝茶的人",
        "bio": "",
        "selectedTeaId": "duyun-maojian",
        "sourceFeedbackId": None,
        "publicQuote": None,
        "publicBlockIds": ["IDENTITY"],
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROFILE_TEA_NOT_ELIGIBLE"

    other_auth = create_auth(client)
    other_tea, other_feedback = create_profile_evidence(client, other_auth)
    foreign = client.put("/api/v1/me/profile", headers=auth, json={
        **update_payload(other_tea, other_feedback),
        "clientEventId": "foreign-quote",
        "publicBlockIds": ["IDENTITY"],
    })
    assert foreign.status_code == 409
    assert foreign.json()["error"]["code"] == "PROFILE_TEA_NOT_ELIGIBLE"

    own_tea, _ = create_profile_evidence(client, auth)
    foreign_quote = client.put("/api/v1/me/profile", headers=auth, json={
        **update_payload(own_tea, other_feedback),
        "clientEventId": "foreign-quote-after-own-tea",
        "publicBlockIds": ["IDENTITY"],
    })
    assert foreign_quote.status_code == 409
    assert foreign_quote.json()["error"]["code"] == "PROFILE_QUOTE_NOT_OWNED"


def test_edit_share_and_events_do_not_change_taste_or_tea_bti(client, auth):
    tea_id, feedback_id = create_profile_evidence(client, auth)
    before_taste = copy.deepcopy(client.get("/api/v1/bootstrap", headers=auth).json()["tasteProfile"])
    before_bti = copy.deepcopy(client.get("/api/v1/me/tea-bti", headers=auth).json())

    updated = client.put("/api/v1/me/profile", headers=auth, json=update_payload(tea_id, feedback_id))
    assert updated.status_code == 200
    assert updated.json()["accepted"] is True
    duplicate = client.put("/api/v1/me/profile", headers=auth, json={
        **update_payload(tea_id, feedback_id),
        "displayName": "不应覆盖",
    })
    assert duplicate.json()["accepted"] is False
    assert duplicate.json()["profile"]["settings"]["displayName"] == "山边喝茶的人"

    viewed = {"clientEventId": "profile-viewed", "eventType": "tea_profile_viewed"}
    assert client.post("/api/v1/me/profile/events", headers=auth, json=viewed).json()["accepted"] is True
    assert client.post("/api/v1/me/profile/events", headers=auth, json=viewed).json()["accepted"] is False

    shared = client.post("/api/v1/me/profile/share", headers=auth, json={"clientEventId": "share-once"})
    assert shared.status_code == 200
    assert shared.json()["accepted"] is True
    assert shared.json()["share"]["active"] is True
    assert len(shared.json()["share"]["publicId"]) >= 22
    assert client.post("/api/v1/me/profile/share", headers=auth, json={"clientEventId": "share-once"}).json()["accepted"] is False

    assert client.get("/api/v1/bootstrap", headers=auth).json()["tasteProfile"] == before_taste
    assert client.get("/api/v1/me/tea-bti", headers=auth).json() == before_bti


def test_public_profile_is_live_private_by_construction_and_revocable(client, auth):
    tea_id, feedback_id = create_profile_evidence(client, auth)
    client.put("/api/v1/me/profile", headers=auth, json=update_payload(tea_id, feedback_id))
    shared = client.post("/api/v1/me/profile/share", headers=auth, json={"clientEventId": "share-public"}).json()
    public_id = shared["share"]["publicId"]

    public = client.get(f"/api/v1/public/profiles/{public_id}")
    assert public.status_code == 200
    payload = public.json()
    assert payload["identity"]["displayName"] == "山边喝茶的人"
    assert payload["myTea"]["teaId"] == tea_id
    assert payload["myWords"]["text"] == "像雨后刚打开的窗，尾巴有一点甜。"
    assert payload["teaPassport"]["items"][0]["tasted"] is True
    serialized = json.dumps(payload, ensure_ascii=False)
    for forbidden in ["userId", "feedbackId", "firstDrunkAt", "favoriteInfusion", "userDescription", "collectedAt"]:
        assert forbidden not in serialized
    assert "像雨后刚打开的窗，清清的，尾巴有一点甜" not in serialized

    opened = {"clientEventId": "public-opened", "eventType": "public_profile_opened"}
    assert client.post(f"/api/v1/public/profiles/{public_id}/events", json=opened).json()["accepted"] is True
    assert client.post(f"/api/v1/public/profiles/{public_id}/events", json=opened).json()["accepted"] is False

    client.put("/api/v1/me/profile", headers=auth, json={
        **update_payload(tea_id, feedback_id),
        "clientEventId": "live-profile-update",
        "displayName": "雾里喝茶的人",
        "publicQuote": "这一口很清，回甘来得慢。",
        "publicBlockIds": ["IDENTITY", "MY_WORDS"],
    })
    live = client.get(f"/api/v1/public/profiles/{public_id}").json()
    assert live["identity"]["displayName"] == "雾里喝茶的人"
    assert live["myTea"] is None
    assert live["teaPassport"] is None
    assert live["myWords"]["text"] == "这一口很清，回甘来得慢。"

    revoked = client.delete("/api/v1/me/profile/share", headers={
        **auth,
        "X-Client-Event-Id": "revoke-profile",
    })
    assert revoked.status_code == 200
    assert revoked.json()["accepted"] is True
    assert revoked.json()["share"]["active"] is False
    unavailable = client.get(f"/api/v1/public/profiles/{public_id}")
    assert unavailable.status_code == 404
    assert unavailable.json()["error"]["code"] == "PUBLIC_PROFILE_NOT_FOUND"

    repeated = client.delete("/api/v1/me/profile/share", headers={
        **auth,
        "X-Client-Event-Id": "revoke-profile",
    }).json()
    assert repeated["accepted"] is False

    reopened = client.post("/api/v1/me/profile/share", headers=auth, json={"clientEventId": "share-again"}).json()
    assert reopened["share"]["publicId"] != public_id
    assert client.get(f"/api/v1/public/profiles/{reopened['share']['publicId']}").status_code == 200


def test_sharing_rejects_an_incomplete_public_block(client, auth):
    profile = client.get("/api/v1/me/profile", headers=auth).json()
    response = client.put("/api/v1/me/profile", headers=auth, json={
        "clientEventId": "incomplete-block",
        "displayName": profile["settings"]["displayName"],
        "bio": "",
        "selectedTeaId": None,
        "sourceFeedbackId": None,
        "publicQuote": None,
        "publicBlockIds": ["IDENTITY", "MY_TEA"],
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROFILE_BLOCK_INCOMPLETE"
