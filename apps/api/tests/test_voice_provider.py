import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.voice import ProviderError, TasteNormalizer, VolcengineOpenApiClient, VoiceProvider, generate_rtc_token


def real_settings() -> Settings:
    return Settings(
        _env_file=None,
        ai_mode="auto",
        volc_access_key_id="ak-test",
        volc_secret_access_key="sk-never-return",
        rtc_app_id="rtc-app",
        rtc_app_key="rtc-key-never-return",
        ark_api_key="ark-never-return",
        rtc_api_version="2025-06-01",
        rtc_voice_model_id="doubao-test-model",
        rtc_voice_config_json=json.dumps({
            "Config": {
                "ASRConfig": {"Provider": "volcano", "ProviderParams": {
                    "Mode": "bigmodel", "ApiResourceId": "legacy-resource",
                }},
                "TTSConfig": {"Provider": "volcano", "ProviderParams": {
                    "Credential": {"ResourceId": "tts-resource"},
                }},
                "LLMConfig": {
                    "Mode": "ArkV3",
                    "ModelName": "doubao-test-model",
                    "SystemMessages": ["another product prompt"],
                    "VisionConfig": {"Enable": True},
                    "Tools": [{"name": "another_product_tool"}],
                },
                "FunctionCallingConfig": {"ServerMessageUrl": "https://example.test"},
            },
        }),
    )


def test_short_rtc_join_payload_does_not_expose_long_term_secrets():
    settings = real_settings()
    provider = VoiceProvider(settings)
    payload = provider.prepare("room-1", "user-1", 2_000_000_000)
    serialized = str(payload)
    assert payload["token"].startswith("001rtc-app")
    for secret in [settings.rtc_app_key, settings.volc_secret_access_key, settings.ark_api_key]:
        assert secret not in serialized


def test_voice_readiness_rejects_incomplete_console_config():
    settings = real_settings().model_copy(update={
        "rtc_voice_config_json": json.dumps({"Config": {"LLMConfig": {"ModelName": "doubao-test-model"}}}),
    })
    assert settings.voice_real_enabled is False
    assert "RTC_VOICE_CONFIG_JSON_INVALID" in settings.voice_missing_config


def test_voice_readiness_rejects_legacy_rtc_api_version():
    settings = real_settings()
    settings.rtc_api_version = "2024-12-01"
    assert settings.voice_real_enabled is False
    assert "RTC_API_VERSION_UNSUPPORTED" in settings.voice_missing_config


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
    asyncio.run(provider.start(
        room_id="room-1", task_id="task-1", target_user_id="user-1",
        tea_id="duyun-maojian", mode="brew", user_context="Taste Profile 已形成。",
        camera_enabled=True,
    ))
    asyncio.run(provider.update_context(room_id="room-1", task_id="task-1", message="用户确认已注水"))
    asyncio.run(provider.stop(room_id="room-1", task_id="task-1"))

    assert [action for action, _ in calls] == ["StartVoiceChat", "UpdateVoiceChat", "StopVoiceChat"]
    start = calls[0][1]
    assert "VisionConfig" not in start["Config"]["LLMConfig"]
    assert "Tools" not in start["Config"]["LLMConfig"]
    assert "FunctionCallingConfig" not in start["Config"]
    assert start["Config"]["SubtitleConfig"]["DisableRTSSubtitle"] is False
    messages = "".join(start["Config"]["LLMConfig"]["SystemMessages"])
    assert "我可以通过画面辅助判断动作" in messages
    assert "不是连续观看视频" in messages
    assert "another product prompt" not in start["Config"]["LLMConfig"]["SystemMessages"]
    assert "Taste Profile 已形成" in "".join(start["Config"]["LLMConfig"]["SystemMessages"])
    assert "ApiResourceId" not in start["Config"]["ASRConfig"]["ProviderParams"]
    assert start["Config"]["TTSConfig"]["ProviderParams"]["Credential"]["ResourceId"] == "tts-resource"
    assert calls[1][1]["Command"] == "ExternalPromptsForLLM"


def test_rtc_token_changes_signature_without_embedding_key():
    token = generate_rtc_token("app", "private-key", "room", "user", 2_000_000_000)
    assert token.startswith("001app")
    assert "private-key" not in token


def test_openapi_network_errors_are_normalized_for_lifecycle_recovery(monkeypatch):
    settings = real_settings()
    client = VolcengineOpenApiClient(settings)

    class FailingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            request = httpx.Request("POST", "https://rtc.volcengineapi.com")
            raise httpx.ConnectError("offline", request=request)

    monkeypatch.setattr("app.voice.httpx.AsyncClient", lambda **_kwargs: FailingClient())
    with pytest.raises(ProviderError, match="网络请求失败") as captured:
        asyncio.run(client.call("StopVoiceChat", {"AppId": "rtc-app"}))
    assert captured.value.outcome_unknown is True


def test_stop_not_found_is_classified_as_terminal(monkeypatch):
    settings = real_settings()
    client = VolcengineOpenApiClient(settings)

    class MissingTaskClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            return httpx.Response(
                404,
                request=httpx.Request("POST", "https://rtc.volcengineapi.com"),
                json={"ResponseMetadata": {"RequestId": "request-missing", "Error": {"Code": "TaskNotFound", "Message": "task not found"}}},
            )

    monkeypatch.setattr("app.voice.httpx.AsyncClient", lambda **_kwargs: MissingTaskClient())
    with pytest.raises(ProviderError) as captured:
        asyncio.run(client.call("StopVoiceChat", {"AppId": "rtc-app"}))
    assert captured.value.terminal is True
    assert captured.value.request_id == "request-missing"


def test_configured_ark_failure_is_not_silently_downgraded(monkeypatch):
    settings = real_settings()
    normalizer = TasteNormalizer(settings)

    class FailingArkClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            raise httpx.ConnectError("offline", request=httpx.Request("POST", settings.ark_base_url))

    monkeypatch.setattr("app.voice.httpx.AsyncClient", lambda **_kwargs: FailingArkClient())
    with pytest.raises(ProviderError) as captured:
        asyncio.run(normalizer.normalize("duyun-maojian", "像青草，后面有点甜"))
    assert captured.value.outcome_unknown is True
