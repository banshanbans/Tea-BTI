from functools import lru_cache
import json
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
    ark_vision_model: str = ""
    ark_voice_endpoint_id: str = ""

    volc_access_key_id: str = ""
    volc_secret_access_key: str = ""
    rtc_app_id: str = ""
    rtc_app_key: str = ""
    rtc_api_version: str = "2025-06-01"
    rtc_voice_config_json: str = ""
    rtc_voice_model_id: str = ""

    # Deprecated direct-service fields retained for compatibility with old
    # local env files. StartVoiceChat 2025-06-01 uses rtc_voice_config_json.
    doubao_speech_app_id: str = ""
    doubao_speech_access_token: str = ""
    doubao_asr_resource_id: str = ""
    doubao_asr_cluster: str = ""
    doubao_tts_resource_id: str = ""
    doubao_tts_voice_type: str = "BV001_streaming"

    voice_session_ttl_seconds: int = 600
    brew_voice_session_ttl_seconds: int = 1800
    transcript_ttl_hours: int = 24
    voice_cleanup_interval_seconds: int = 60
    brew_companion_v2: bool = True

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
    def tea_bti_persona_path(self) -> Path:
        return self.repository_root / "apps" / "api" / "data" / "tea-bti-personas.json"

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
            "RTC_VOICE_CONFIG_JSON": self.rtc_voice_config_json,
        }
        missing = [name for name, value in required.items() if not value]
        if self.rtc_api_version != "2025-06-01":
            missing.append("RTC_API_VERSION_UNSUPPORTED")
        if self.rtc_voice_config_json:
            try:
                template = json.loads(self.rtc_voice_config_json)
                config = template.get("Config") if isinstance(template, dict) else None
                llm = config.get("LLMConfig") if isinstance(config, dict) else None
                asr = config.get("ASRConfig") if isinstance(config, dict) else None
                tts = config.get("TTSConfig") if isinstance(config, dict) else None
                if (
                    not isinstance(config, dict)
                    or not isinstance(asr, dict)
                    or not isinstance(tts, dict)
                    or not isinstance(llm, dict)
                    or not llm.get("ModelName")
                ):
                    missing.append("RTC_VOICE_CONFIG_JSON_INVALID")
            except (TypeError, ValueError, json.JSONDecodeError):
                missing.append("RTC_VOICE_CONFIG_JSON_INVALID")
        return missing

    @property
    def voice_real_enabled(self) -> bool:
        return self.ai_mode != "mock" and not self.voice_missing_config

    @property
    def vision_real_enabled(self) -> bool:
        return self.brew_companion_v2 and self.ai_mode != "mock" and bool(self.ark_api_key and self.ark_vision_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
