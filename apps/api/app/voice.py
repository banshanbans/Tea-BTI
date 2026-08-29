from __future__ import annotations

import base64
import hashlib
import hmac
import json
import random
import struct
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from .catalog import catalog
from .config import Settings, get_settings
from .taste import ALLOWED_TAGS, mock_normalize


class ProviderError(RuntimeError):
    pass


def _pack_bytes(value: bytes) -> bytes:
    return struct.pack("<H", len(value)) + value


def generate_rtc_token(app_id: str, app_key: str, room_id: str, user_id: str, expires_at: int) -> str:
    """Generate the veRTC token format used by the official rtc-aigc-demo."""
    issued_at = int(datetime.now(timezone.utc).timestamp())
    privileges = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    message = b"".join([
        struct.pack("<I", random.SystemRandom().randint(0, 0xFFFFFFFF)),
        struct.pack("<I", issued_at),
        struct.pack("<I", expires_at),
        _pack_bytes(room_id.encode()),
        _pack_bytes(user_id.encode()),
        struct.pack("<H", len(privileges)),
        b"".join(struct.pack("<HI", key, value) for key, value in privileges.items()),
    ])
    signature = hmac.new(app_key.encode(), message, hashlib.sha256).digest()
    content = _pack_bytes(message) + _pack_bytes(signature)
    return "001" + app_id + base64.b64encode(content).decode()


class VolcengineOpenApiClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.host = "rtc.volcengineapi.com"
        self.region = "cn-north-1"
        self.service = "rtc"

    @staticmethod
    def _sign(key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode(), hashlib.sha256).digest()

    def _headers(self, action: str, version: str, body_bytes: bytes) -> dict[str, str]:
        now = datetime.now(timezone.utc)
        x_date = now.strftime("%Y%m%dT%H%M%SZ")
        short_date = now.strftime("%Y%m%d")
        payload_hash = hashlib.sha256(body_bytes).hexdigest()
        query = "Action=" + quote(action, safe="-_.~") + "&Version=" + quote(version, safe="-_.~")
        canonical_headers = (
            "content-type:application/json\n"
            f"host:{self.host}\n"
            f"x-content-sha256:{payload_hash}\n"
            f"x-date:{x_date}\n"
        )
        signed_headers = "content-type;host;x-content-sha256;x-date"
        canonical_request = "\n".join(["POST", "/", query, canonical_headers, signed_headers, payload_hash])
        scope = f"{short_date}/{self.region}/{self.service}/request"
        string_to_sign = "\n".join(["HMAC-SHA256", x_date, scope, hashlib.sha256(canonical_request.encode()).hexdigest()])
        k_date = self._sign(self.settings.volc_secret_access_key.encode(), short_date)
        k_region = self._sign(k_date, self.region)
        k_service = self._sign(k_region, self.service)
        k_signing = self._sign(k_service, "request")
        signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
        authorization = (
            f"HMAC-SHA256 Credential={self.settings.volc_access_key_id}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        return {
            "Content-Type": "application/json",
            "Host": self.host,
            "X-Content-Sha256": payload_hash,
            "X-Date": x_date,
            "Authorization": authorization,
        }

    async def call(self, action: str, body: dict[str, Any]) -> dict[str, Any]:
        body_bytes = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()
        version = self.settings.rtc_api_version
        headers = self._headers(action, version, body_bytes)
        url = f"https://{self.host}?Action={action}&Version={version}"
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(url, headers=headers, content=body_bytes)
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderError(f"火山 RTC 返回了非 JSON 响应：HTTP {response.status_code}") from exc
        error = payload.get("ResponseMetadata", {}).get("Error")
        if response.is_error or error:
            message = (error or {}).get("Message") or f"HTTP {response.status_code}"
            raise ProviderError(f"火山 RTC 调用失败：{message}")
        return payload


class VoiceProvider:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.client = VolcengineOpenApiClient(self.settings)

    def prepare(self, room_id: str, user_id: str, expires_at: int) -> dict[str, str]:
        token = generate_rtc_token(
            self.settings.rtc_app_id,
            self.settings.rtc_app_key,
            room_id,
            user_id,
            expires_at,
        )
        return {
            "appId": self.settings.rtc_app_id,
            "roomId": room_id,
            "userId": user_id,
            "token": token,
            "agentUserId": "tea_companion",
        }

    def _system_messages(self, tea_id: str, mode: str) -> list[str]:
        tea = catalog.require_tea(tea_id)
        guide = tea["brewingGuide"]
        factual_context = (
            f"当前茶：{tea['name']}；产区：{tea['region']}；茶类：{tea['teaType']}；"
            f"审核感官描述：{tea['officialDescription']}；建议器具：{guide['vessel']}；"
            f"建议水温：{guide['temperatureRange']}；建议时间：{guide['steepTime']}。"
        )
        boundaries = (
            "你是 Tea-BTI 的茶伴，表达简短、温和、一次只给一到两个动作。"
            "你没有摄像头，不能声称看到了茶具、动作、水温或茶叶克数；不能给出未经资料支持的精确值。"
            "如用户提供的信息不足，要使用‘如果’‘大约’并请用户确认。"
        )
        if mode == "brew":
            task = "陪用户按准备、温杯、投茶、注水、浸泡、出汤、品饮的顺序完成冲泡。"
        else:
            task = "先接住用户的自然语言感受，再解释它可能对应的茶语；不要说用户喝错了。"
        return [boundaries, factual_context, task]

    async def start(self, *, room_id: str, task_id: str, target_user_id: str, tea_id: str, mode: str) -> None:
        settings = self.settings
        asr_params: dict[str, Any] = {
            "Mode": "bigmodel" if settings.doubao_asr_resource_id else "smallmodel",
            "AppId": settings.doubao_speech_app_id,
            "AccessToken": settings.doubao_speech_access_token,
        }
        if settings.doubao_asr_resource_id:
            asr_params["ApiResourceId"] = settings.doubao_asr_resource_id
        if settings.doubao_asr_cluster:
            asr_params["Cluster"] = settings.doubao_asr_cluster
        body = {
            "AppId": settings.rtc_app_id,
            "RoomId": room_id,
            "TaskId": task_id,
            "AgentConfig": {
                "TargetUserId": [target_user_id],
                "WelcomeMessage": "你好，我是茶伴。我们慢慢来，你现在准备到哪一步了？" if mode == "brew" else "先用你自己的话说说这一口，不需要懂茶语。",
                "UserId": "tea_companion",
                "EnableConversationStateCallback": True,
            },
            "Config": {
                "ASRConfig": {"Provider": "volcano", "ProviderParams": asr_params},
                "TTSConfig": {
                    "Provider": "volcano",
                    "ProviderParams": {
                        "app": {
                            "appid": settings.doubao_speech_app_id,
                            "token": settings.doubao_speech_access_token,
                            "cluster": settings.doubao_tts_resource_id,
                        },
                        "audio": {"voice_type": settings.doubao_tts_voice_type, "speed_ratio": 1.0, "pitch_ratio": 1.0, "volume_ratio": 1.0},
                    },
                },
                "LLMConfig": {
                    "Mode": "ArkV3",
                    "EndPointId": settings.ark_voice_endpoint_id,
                    "ApiKey": settings.ark_api_key,
                    "SystemMessages": self._system_messages(tea_id, mode),
                    "VisionConfig": {"Enable": False},
                },
                "SubtitleConfig": {"DisableRTSSubtitle": False, "SubtitleMode": 1},
                "InterruptMode": 0,
            },
        }
        await self.client.call("StartVoiceChat", body)

    async def update_context(self, *, room_id: str, task_id: str, message: str) -> None:
        await self.client.call("UpdateVoiceChat", {
            "AppId": self.settings.rtc_app_id,
            "RoomId": room_id,
            "TaskId": task_id,
            "Command": "ExternalPromptsForLLM",
            "Message": message,
        })

    async def stop(self, *, room_id: str, task_id: str) -> None:
        await self.client.call("StopVoiceChat", {
            "AppId": self.settings.rtc_app_id,
            "RoomId": room_id,
            "TaskId": task_id,
        })


class TasteNormalizer:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def normalize(self, tea_id: str, text: str) -> tuple[list[str], str, str]:
        if self.settings.ai_mode == "mock" or not self.settings.ark_api_key:
            tags, explanation = mock_normalize(text)
            return tags, explanation, "server_mock"
        tea = catalog.require_tea(tea_id)
        prompt = {
            "role": "user",
            "content": (
                "只返回 JSON 对象，字段为 normalizedTags 和 explanation。"
                f"normalizedTags 只能从 {ALLOWED_TAGS} 中选择。"
                "不要判断对错，不要创造茶的客观事实。"
                f"当前茶的审核标签是 {tea['professionalTags']}。用户原话：{text}"
            ),
        }
        payload = {"model": self.settings.ark_text_model, "messages": [prompt]}
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(
                    self.settings.ark_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {self.settings.ark_api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            parsed = json.loads(content)
            tags = [tag for tag in parsed.get("normalizedTags", []) if tag in ALLOWED_TAGS]
            if not tags:
                raise ValueError("模型未返回允许的标签")
            return list(dict.fromkeys(tags)), str(parsed.get("explanation") or "已把你的表达整理成茶语。"), "ark_text"
        except (httpx.HTTPError, KeyError, IndexError, ValueError, json.JSONDecodeError):
            tags, explanation = mock_normalize(text)
            return tags, explanation, "server_mock"


voice_provider = VoiceProvider()
taste_normalizer = TasteNormalizer()
