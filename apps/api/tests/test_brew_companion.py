from datetime import datetime, timezone


def create_brew(client, auth, tea_id="duyun-maojian", **setup):
    response = client.post("/api/v1/voice/sessions", headers=auth, json={
        "mode": "brew",
        "teaId": tea_id,
        "cameraEnabled": setup.pop("cameraEnabled", False),
        "brewSetup": setup or None,
    })
    assert response.status_code == 201
    return response.json()


def brew_event(client, auth, session_id, client_id, event_type, **payload):
    return client.post(f"/api/v1/voice/sessions/{session_id}/brew/events", headers=auth, json={
        "clientEventId": client_id,
        "eventType": event_type,
        "source": payload.pop("source", "touch"),
        **payload,
    })


def advance_first_infusion_to_taste(client, auth, session_id):
    for index, stage in enumerate(("warm_vessel", "add_leaves", "pour", "steep", "decant", "taste"), start=1):
        response = brew_event(client, auth, session_id, f"stage-{index}", "confirm_stage", stage=stage)
        assert response.status_code == 200
    return response.json()["brewState"]


def test_brew_session_has_30_minute_ttl_and_absolute_timer(client, auth):
    created = create_brew(client, auth, vessel="玻璃杯", waterVolumeMl=180)
    state = created["brewState"]
    assert state["currentStage"] == "prepare"
    assert state["plannedDurationSeconds"] == 60
    assert state["waterVolumeMl"] == 180
    expires = datetime.fromisoformat(created["expiresAt"].replace("Z", "+00:00"))
    remaining = (expires - datetime.now(timezone.utc)).total_seconds()
    assert 1790 <= remaining <= 1800

    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    for index, stage in enumerate(("warm_vessel", "add_leaves", "pour", "steep"), start=1):
        state = brew_event(client, auth, session_id, f"timer-{index}", "confirm_stage", stage=stage).json()["brewState"]
    assert state["timerStartedAt"] is not None
    assert state["deadlineAt"] is not None
    assert 59 <= state["remainingSeconds"] <= 60

    extended = brew_event(client, auth, session_id, "extend-once", "timer_adjust", seconds=5).json()
    duplicate = brew_event(client, auth, session_id, "extend-once", "timer_adjust", seconds=5).json()
    assert extended["brewState"]["plannedDurationSeconds"] == 65
    assert duplicate["accepted"] is False
    assert duplicate["brewState"]["plannedDurationSeconds"] == 65


def test_feedback_changes_only_one_next_infusion_parameter(client, auth):
    created = create_brew(client, auth, vessel="盖碗")
    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    advance_first_infusion_to_taste(client, auth, session_id)

    feedback = brew_event(
        client, auth, session_id, "feedback-1", "taste_feedback",
        feedback="astringent", userWords="有点涩",
    ).json()
    assert "少等 5 秒" in feedback["message"]
    next_state = brew_event(client, auth, session_id, "next-1", "next_infusion").json()["brewState"]
    assert next_state["currentStage"] == "pour"
    assert next_state["infusionNumber"] == 2
    assert next_state["plannedDurationSeconds"] == 15
    assert next_state["temperatureC"] == created["brewState"]["temperatureC"]


def test_temperature_feedback_is_clamped_and_does_not_change_time(client, auth):
    created = create_brew(client, auth, vessel="玻璃杯")
    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    advance_first_infusion_to_taste(client, auth, session_id)
    brew_event(client, auth, session_id, "feedback-hot", "taste_feedback", feedback="too_hot", userWords="太烫了")
    state = brew_event(client, auth, session_id, "next-hot", "next_infusion").json()["brewState"]
    assert state["temperatureC"] == 80
    assert state["plannedDurationSeconds"] == 60


def test_matcha_is_one_pass_and_starts_at_add_powder(client, auth):
    created = create_brew(client, auth, tea_id="fanjingshan-matcha")
    state = created["brewState"]
    assert state["isMatcha"] is True
    assert state["maxInfusions"] == 1
    assert state["currentStage"] == "add_leaves"
    assert state["plannedDurationSeconds"] == 20
    assert state["cameraEnabled"] is False


def test_visual_frames_only_create_candidate_and_confirmation_is_required(client, auth, monkeypatch):
    from app.db import SessionLocal
    from app.main import settings
    from app.models import VoiceSession

    monkeypatch.setattr(settings, "ai_mode", "auto")
    monkeypatch.setattr(settings, "ark_api_key", "test-key")
    monkeypatch.setattr(settings, "ark_vision_model", "test-vision-model")
    results = iter((("leaves_present", 0.6), ("leaves_present", 0.98), ("leaves_present", 0.98)))

    async def observe(_image, _stage):
        return next(results)

    monkeypatch.setattr("app.main.vision_provider.observe", observe)
    created = create_brew(client, auth, cameraEnabled=True)
    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    with SessionLocal() as db:
        voice_session = db.get(VoiceSession, session_id)
        voice_session.provider_mode = "volcengine_rtc"
        voice_session.room_id = "vision-room"
        voice_session.task_id = "vision-task"
        db.commit()
    visual_contexts = []

    async def update_context(**kwargs):
        visual_contexts.append(kwargs["message"])

    monkeypatch.setattr("app.main.voice_provider.update_context", update_context)
    brew_event(client, auth, session_id, "vision-stage-1", "confirm_stage", stage="warm_vessel")
    brew_event(client, auth, session_id, "vision-stage-2", "confirm_stage", stage="add_leaves")
    visual_contexts.clear()

    url = f"/api/v1/voice/sessions/{session_id}/vision/observations?stage=add_leaves&infusionNumber=1"
    frame = b"\xff\xd8fixed-jpeg-frame\xff\xd9"
    low = client.post(url, headers={**auth, "Content-Type": "image/jpeg"}, content=frame).json()
    first = client.post(url, headers={**auth, "Content-Type": "image/jpeg"}, content=frame).json()
    second = client.post(url, headers={**auth, "Content-Type": "image/jpeg"}, content=frame).json()
    assert low["candidate"] is False
    assert first["candidate"] is False
    assert second["candidate"] is True
    assert second["targetStage"] == "pour"
    assert second["brewState"]["currentStage"] == "add_leaves"
    assert len(visual_contexts) == 2
    assert "目前只有一帧证据" in visual_contexts[0]
    assert "连续两帧" in visual_contexts[1]

    stale = brew_event(
        client, auth, session_id, "wrong-camera-confirm", "confirm_stage",
        source="camera_confirmed", stage="steep",
    )
    assert stale.status_code == 409
    confirmed = brew_event(
        client, auth, session_id, "camera-confirm", "confirm_stage",
        source="camera_confirmed", stage="pour",
    ).json()
    assert confirmed["brewState"]["currentStage"] == "pour"


def test_voice_feedback_priority_prefers_temperature_and_is_idempotent(client, auth):
    created = create_brew(client, auth)
    session_id = created["voiceSessionId"]
    client.post(f"/api/v1/voice/sessions/{session_id}/start", headers=auth)
    advance_first_infusion_to_taste(client, auth, session_id)
    turn = {"turns": [{
        "clientTurnId": "spoken-feedback", "role": "user", "text": "有点烫，也有点涩",
    }]}
    first = client.post(f"/api/v1/voice/sessions/{session_id}/turns", headers=auth, json=turn).json()
    second = client.post(f"/api/v1/voice/sessions/{session_id}/turns", headers=auth, json=turn).json()
    assert first["brewState"]["completedInfusions"][0]["feedback"] == "too_hot"
    assert first["brewState"]["completedInfusions"][0]["adjustmentType"] == "temperature"
    assert second["acceptedCount"] == 0
