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


def scene_result(scene, stop_window="balanced"):
    if scene == "pick-bud":
        return {
            "kind": "pick-bud", "selectedBud": "bud-leaf", "wrongSelections": ["bud-open"],
            "teacherShown": True, "inputMode": "pointer",
        }
    if scene == "wok-craft":
        return {
            "kind": "wok-craft", "steamMode": "wipe",
            "gestures": {
                name: {"inputMode": "pointer", "score": score, "attempts": 1}
                for name, score in {"killGreen": 78, "rolling": 82, "balling": 74, "pekoe": 76}.items()
            },
        }
    if scene == "human-judgment":
        maturity = {"early": 1, "balanced": 3, "late": 5}[stop_window]
        return {"kind": "human-judgment", "maturityLevel": maturity, "stopWindow": stop_window}
    return None


def advance_first_six(client, auth, run_id, *, prefix="realm-scene", stop_window="balanced"):
    for index, scene in enumerate(SCENES[:-1]):
        response = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
            "clientEventId": f"{prefix}-{index}",
            "runId": run_id,
            "completedScene": scene,
            "sceneResult": scene_result(scene, stop_window),
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
    for role in {"teacher_observe", "teacher_correction", "teacher_explain"}:
        assert assets[role]["sourceKind"] == "ai_generated"
        assert assets[role]["authenticityState"] == "synthetic_demo"
        assert assets[role]["rightsState"] == "demo_only"
        assert assets[role]["url"].startswith("/api/v1/media/realm/")


def test_preview_event_does_not_start_a_realm_run(client, auth):
    event = client.post(f"/api/v1/realms/{REALM_ID}/events", headers=auth, json={
        "clientEventId": "realm-preview-only", "eventType": "realm_preview_opened", "sceneId": None,
    })
    assert event.status_code == 200
    assert event.json()["progress"]["status"] == "available"
    assert event.json()["run"] is None
    detail = client.get(f"/api/v1/realms/{REALM_ID}", headers=auth).json()
    assert detail["progress"]["status"] == "available"
    assert detail["run"] is None


def test_runtime_fallback_reasons_are_accepted(client, auth):
    for index, reason in enumerate(["sensor_timeout", "microphone_timeout", "microphone_denied", "multitouch_unsupported"]):
        response = client.post(f"/api/v1/realms/{REALM_ID}/events", headers=auth, json={
            "clientEventId": f"realm-runtime-fallback-{index}",
            "eventType": "realm_interaction_fallback_used",
            "sceneId": "wok-craft",
            "interactionMode": "pointer",
            "fallbackReason": reason,
        })
        assert response.status_code == 200
        assert response.json()["accepted"] is True


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
    run_id = created.json()["run"]["runId"]
    assert start(client, auth).json()["accepted"] is False

    out_of_order = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-wrong-order", "runId": run_id, "completedScene": "pick-bud",
        "sceneResult": scene_result("pick-bud"), "elapsedMs": 100,
    })
    assert out_of_order.status_code == 409
    assert out_of_order.json()["error"]["code"] == "REALM_SCENE_OUT_OF_ORDER"
    assert out_of_order.json()["error"]["details"]["expectedScene"] == "liquor-entry"

    first = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-first-scene", "runId": run_id,
        "completedScene": "liquor-entry", "elapsedMs": 1200,
    })
    assert first.json()["accepted"] is True
    duplicate = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-first-scene", "runId": run_id,
        "completedScene": "liquor-entry", "elapsedMs": 1200,
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
    run_id = start(client, auth).json()["run"]["runId"]
    advance_first_six(client, auth, run_id)

    premature_scene = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "realm-final-via-progress", "runId": run_id,
        "completedScene": "passport-specimen", "elapsedMs": 200,
    })
    assert premature_scene.status_code == 409
    assert premature_scene.json()["error"]["code"] == "REALM_SCENE_OUT_OF_ORDER"

    completed = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-complete", "runId": run_id,
        "totalElapsedMs": 52000, "interactionMode": "pointer",
    })
    assert completed.status_code == 200
    payload = completed.json()
    assert payload["accepted"] is True
    assert payload["specimenAwarded"] is True
    assert payload["outcome"]["title"] == "清鲜的白毫"
    assert payload["passportEntry"]["realmOutcome"] == payload["outcome"]
    assert payload["progress"]["status"] == "completed"
    assert payload["specimen"]["specimenId"] == "duyun-maojian-pekoe"
    assert payload["passportEntry"]["realmUnlocked"] is True
    assert payload["passportEntry"]["realmCompletedAt"] is not None
    assert len(payload["passportEntry"]["specimens"]) == 1

    repeated = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-complete-again", "runId": run_id,
        "totalElapsedMs": 56000, "interactionMode": "pointer",
    }).json()
    assert repeated["accepted"] is False
    assert repeated["specimenAwarded"] is False
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
    run_id = start(client, auth).json()["run"]["runId"]
    response = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "realm-too-soon", "runId": run_id,
        "totalElapsedMs": 1000, "interactionMode": "pointer",
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REALM_COMPLETION_INCOMPLETE"


def test_replay_has_its_own_run_updates_outcome_and_never_duplicates_specimen(client, auth):
    first_run = start(client, auth).json()["run"]["runId"]
    advance_first_six(client, auth, first_run, prefix="first-run", stop_window="early")
    first = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "first-complete", "runId": first_run,
        "totalElapsedMs": 70000, "interactionMode": "pointer",
    }).json()
    first_completed_at = first["progress"]["completedAt"]
    assert first["outcome"]["title"] == "鲜青的一芽"

    replay = start(client, auth, event_id="replay-start", replay=True).json()
    replay_run = replay["run"]["runId"]
    assert replay_run != first_run
    assert replay["run"]["replay"] is True
    advance_first_six(client, auth, replay_run, prefix="replay-run", stop_window="late")
    second = client.post(f"/api/v1/realms/{REALM_ID}/complete", headers=auth, json={
        "clientEventId": "replay-complete", "runId": replay_run,
        "totalElapsedMs": 84000, "interactionMode": "pointer",
    }).json()
    assert second["accepted"] is True
    assert second["specimenAwarded"] is False
    assert second["outcome"]["title"] == "带火香的一芽"
    assert second["progress"]["completedAt"] == first_completed_at
    assert len(second["passportEntry"]["specimens"]) == 1


def test_scene_result_is_whitelisted_and_bound_to_scene(client, auth):
    run_id = start(client, auth).json()["run"]["runId"]
    invalid = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "invalid-result", "runId": run_id, "completedScene": "liquor-entry",
        "sceneResult": scene_result("pick-bud"), "elapsedMs": 100,
    })
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "REALM_SCENE_RESULT_INVALID"

    wrong_run = client.patch(f"/api/v1/realms/{REALM_ID}/progress", headers=auth, json={
        "clientEventId": "wrong-run", "runId": "not-this-run", "completedScene": "liquor-entry", "elapsedMs": 100,
    })
    assert wrong_run.status_code == 409
    assert wrong_run.json()["error"]["code"] == "REALM_RUN_MISMATCH"


def test_tea_detail_exposes_realm_mapping_without_frontend_hardcode(client, auth):
    assert client.get("/api/v1/teas/duyun-maojian", headers=auth).json()["realmId"] == REALM_ID
    assert client.get("/api/v1/teas/meitan-cuiya", headers=auth).json()["realmId"] is None
