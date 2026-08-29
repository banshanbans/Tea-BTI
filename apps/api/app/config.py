from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Tea-BTI API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./.data/tea-bti.db"
    web_origin: str = "http://localhost:3000"
    ai_mode: Literal["auto", "mock", "volcengine"] = "auto"

    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    ark_api_key: str = ""
    ark_text_model: str = "doubao-seed-2-0-lite-260215"
    ark_voice_endpoint_id: str = ""

    volc_access_key_id: str = ""
    volc_secret_access_key: str = ""
    rtc_app_id: str = ""
    rtc_app_key: str = ""
    rtc_api_version: str = "2024-12-01"
    doubao_speech_app_id: str = ""
    doubao_speech_access_token: str = ""
    doubao_asr_resource_id: str = ""
    doubao_asr_cluster: str = ""
    doubao_tts_resource_id: str = ""
    doubao_tts_voice_type: str = "BV001_streaming"

    voice_session_ttl_seconds: int = 600
    transcript_ttl_hours: int = 24

    @property
    def repository_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def catalog_path(self) -> Path:
        return self.repository_root / "apps" / "api" / "data" / "tea-catalog.json"

    @property
    def mbti_seed_path(self) -> Path:
        return self.repository_root / "apps" / "api" / "data" / "mbti-seeds.json"

    @property
    def realm_catalog_path(self) -> Path:
        return self.repository_root / "apps" / "api" / "data" / "realm-catalog.json"

    @property
    def visual_manifest_path(self) -> Path:
        return self.repository_root / "assets" / "tea-visuals" / "manifest.json"

    @property
    def voice_missing_config(self) -> list[str]:
        required = {
            "VOLC_ACCESS_KEY_ID": self.volc_access_key_id,
            "VOLC_SECRET_ACCESS_KEY": self.volc_secret_access_key,
            "RTC_APP_ID": self.rtc_app_id,
            "RTC_APP_KEY": self.rtc_app_key,
            "ARK_API_KEY": self.ark_api_key,
            "ARK_VOICE_ENDPOINT_ID": self.ark_voice_endpoint_id,
            "DOUBAO_SPEECH_APP_ID": self.doubao_speech_app_id,
            "DOUBAO_SPEECH_ACCESS_TOKEN": self.doubao_speech_access_token,
            "DOUBAO_TTS_RESOURCE_ID": self.doubao_tts_resource_id,
        }
        if not self.doubao_asr_resource_id and not self.doubao_asr_cluster:
            required["DOUBAO_ASR_RESOURCE_ID_OR_CLUSTER"] = ""
        return [name for name, value in required.items() if not value]

    @property
    def voice_real_enabled(self) -> bool:
        return self.ai_mode != "mock" and not self.voice_missing_config


@lru_cache
def get_settings() -> Settings:
    return Settings()
