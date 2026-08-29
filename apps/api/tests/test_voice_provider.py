import asyncio

from app.config import Settings
from app.voice import VolcengineOpenApiClient, VoiceProvider, generate_rtc_token


def real_settings() -> Settings:
    return Settings(
        _env_file=None,
        ai_mode="auto",
        volc_access_key_id="ak-test",
        volc_secret_access_key="sk-never-return",
        rtc_app_id="rtc-app",
        rtc_app_key="rtc-key-never-return",
        ark_api_key="ark-never-return",
        ark_voice_endpoint_id="ep-voice",
        doubao_speech_app_id="speech-app",
        doubao_speech_access_token="speech-never-return",
        doubao_asr_resource_id="volc.bigasr.sauc.duration",
        doubao_tts_resource_id="volc.service_type.10029",
        doubao_tts_voice_type="BV001_streaming",
    )


def test_short_rtc_join_payload_does_not_expose_long_term_secrets():
    settings = real_settings()
    provider = VoiceProvider(settings)
    payload = provider.prepare("room-1", "user-1", 2_000_000_000)
    serialized = str(payload)
    assert payload["token"].startswith("001rtc-app")
    for secret in [settings.rtc_app_key, settings.volc_secret_access_key, settings.ark_api_key, settings.doubao_speech_access_token]:
        assert secret not in serialized


def test_v4_signing_headers_do_not_contain_raw_secret():
    settings = real_settings()
    client = VolcengineOpenApiClient(settings)
    headers = client._headers("StartVoiceChat", settings.rtc_api_version, b"{}")
    assert headers["Authorization"].startswith("HMAC-SHA256 Credential=ak-test/")
    assert settings.volc_secret_access_key not in str(headers)


def test_voice_adapter_emits_start_update_and_stop_contracts():
    settings = real_settings()
    provider = VoiceProvider(settings)
    calls = []

    class FakeClient:
        async def call(self, action, body):
            calls.append((action, body))
            return {}

    provider.client = FakeClient()
    asyncio.run(provider.start(room_id="room-1", task_id="task-1", target_user_id="user-1", tea_id="duyun-maojian", mode="brew"))
    asyncio.run(provider.update_context(room_id="room-1", task_id="task-1", message="用户确认已注水"))
    asyncio.run(provider.stop(room_id="room-1", task_id="task-1"))

    assert [action for action, _ in calls] == ["StartVoiceChat", "UpdateVoiceChat", "StopVoiceChat"]
    start = calls[0][1]
    assert start["Config"]["LLMConfig"]["VisionConfig"]["Enable"] is False
    assert start["Config"]["SubtitleConfig"]["DisableRTSSubtitle"] is False
    assert "不能声称看到" in "".join(start["Config"]["LLMConfig"]["SystemMessages"])
    assert calls[1][1]["Command"] == "ExternalPromptsForLLM"


def test_rtc_token_changes_signature_without_embedding_key():
    token = generate_rtc_token("app", "private-key", "room", "user", 2_000_000_000)
    assert token.startswith("001app")
    assert "private-key" not in token
