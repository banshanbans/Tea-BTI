import copy


REALM_ID = "duyun-maojian-mist-bud"
SCENES = [
    "liquor-entry",
    "mist-mountain",
    "pick-bud",
    "wok-craft",
    "human-judgment",
    "real-tea-reveal",
    "passport-specimen",
]


def start(client, auth, event_id="realm-start", **overrides):
    payload = {
        "clientEventId": event_id,
        "interactionMode": "pointer",
        "fallbackReason": "desktop",
        "replay": False,
        **overrides,
    }
    return client.post(f"/api/v1/realms/{REALM_ID}/start", headers=auth, json=payload)


def advance_first_six(client, auth):
    for index, scene in enumerate(SCENES[:-1]):
        response = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
            "clientEventId": f"realm-scene-{index}",
            "completedScene": scene,
            "elapsedMs": 7000,
        })
        assert response.status_code == 200
        assert response.json()["accepted"] is True


def test_realm_is_freely_available_and_assets_keep_fact_boundaries(client, auth):
    listing = client.get("/api/v1/realms", headers=auth)
    assert listing.status_code == 200
    realm = listing.json()["items"][0]
    assert realm["realmId"] == REALM_ID
    assert realm["progress"]["status"] == "available"
    assert listing.json()["litRegionIds"] == []

    detail = client.get(f"/api/v1/realms/{REALM_ID}", headers=auth).json()
    assert detail["personalization"]["source"] == "default"
    assert detail["definition"]["sceneOrder"] == SCENES
    assets = {asset["role"]: asset for asset in detail["definition"]["assets"]}
    assert assets["dry_tea_reveal"]["authenticityState"] == "documentary"
    assert assets["dry_tea_reveal"]["rightsState"] == "open_license"
    for role in {"mist_overlay", "mountain_background", "workshop_background", "specimen_card"}:
        assert assets[role]["authenticityState"] == "synthetic_demo"


def test_realm_personalization_uses_confirmed_taste_words(client, auth):
    client.post("/api/v1/taste/normalize", headers=auth, json={
        "teaId": "duyun-maojian", "text": "像雨后的青草，尾巴有一点甜", "infusionNumber": 2,
    })
    detail = client.get(f"/api/v1/realms/{REALM_ID}", headers=auth).json()
    assert detail["personalization"]["source"] == "taste"
    assert detail["personalization"]["userWords"] == "像雨后的青草，尾巴有一点甜"
    assert "像雨后的青草" in detail["personalization"]["introCopy"]


def test_realm_progress_is_ordered_resumable_and_events_are_idempotent(client, auth):
    created = start(client, auth)
    assert created.status_code == 200
    assert created.json()["progress"]["interactionMode"] == "pointer"
    assert start(client, auth).json()["accepted"] is False

    out_of_order = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-wrong-order", "completedScene": "pick-bud", "elapsedMs": 100,
    })
    assert out_of_order.status_code == 409
    assert out_of_order.json()["error"]["code"] == "REALM_SCENE_OUT_OF_ORDER"
    assert out_of_order.json()["error"]["details"]["expectedScene"] == "liquor-entry"

    first = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-first-scene", "completedScene": "liquor-entry", "elapsedMs": 1200,
    })
    assert first.json()["accepted"] is True
    duplicate = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-first-scene", "completedScene": "liquor-entry", "elapsedMs": 1200,
    })
    assert duplicate.json()["accepted"] is False
    resumed = client.get(f"/api/v1/realms/{REALM_ID}", headers=auth).json()["progress"]
    assert resumed["currentScene"] == "mist-mountain"
    assert resumed["completedScenes"] == ["liquor-entry"]

    event = {"clientEventId": "realm-reveal-event", "eventType": "realm_real_asset_revealed", "sceneId": "real-tea-reveal"}
    assert client.post(f"/api/v1/realms/{REALM_ID}/events", headers=auth, json=event).json()["accepted"] is True
    assert client.post(f"/api/v1/realms/{REALM_ID}/events", headers=auth, json=event).json()["accepted"] is False


def test_realm_completion_is_atomic_unique_and_does_not_change_taste_or_tea_bti(client, auth):
    before_taste = copy.deepcopy(client.get("/api/v1/bootstrap", headers=auth).json()["tasteProfile"])
    before_bti = copy.deepcopy(client.get("/api/v1/me/tea-bti", headers=auth).json())
    start(client, auth)
    advance_first_six(client, auth)

    premature_scene = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-final-via-progress", "completedScene": "passport-specimen", "elapsedMs": 200,
    })
    assert premature_scene.status_code == 409
    assert premature_scene.json()["error"]["code"] == "REALM_SCENE_OUT_OF_ORDER"

    completed = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-complete", "totalElapsedMs": 52000, "interactionMode": "pointer",
    })
    assert completed.status_code == 200
    payload = completed.json()
    assert payload["accepted"] is True
    assert payload["progress"]["status"] == "completed"
    assert payload["specimen"]["specimenId"] == "duyun-maojian-pekoe"
    assert payload["passportEntry"]["realmUnlocked"] is True
    assert payload["passportEntry"]["realmCompletedAt"] is not None
    assert len(payload["passportEntry"]["specimens"]) == 1

    repeated = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-complete-again", "totalElapsedMs": 56000, "interactionMode": "pointer",
    }).json()
    assert repeated["accepted"] is False
    assert repeated["specimen"]["collectedAt"] == payload["specimen"]["collectedAt"]
    assert len(repeated["passportEntry"]["specimens"]) == 1

    listing = client.get("/api/v1/realms", headers=auth).json()
    assert listing["litRegionIds"] == ["qiannan"]
    assert listing["items"][0]["specimen"]["specimenId"] == "duyun-maojian-pekoe"
    assert client.get("/api/v1/bootstrap", headers=auth).json()["tasteProfile"] == before_taste
    assert client.get("/api/v1/me/tea-bti", headers=auth).json() == before_bti
    journey = client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["journey"]
    assert journey["realmCompleted"] is True
    assert journey["nextStep"] == "brew"


def test_realm_completion_requires_first_six_scenes(client, auth):
    start(client, auth)
    response = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-too-soon", "totalElapsedMs": 1000, "interactionMode": "pointer",
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REALM_COMPLETION_INCOMPLETE"


def test_tea_detail_exposes_realm_mapping_without_frontend_hardcode(client, auth):
    assert client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["realmId"] == REALM_ID
    assert client.get("/api/v1/teas/meitan-cuiya", headers=auth).json()["realmId"] is None
