from __future__ import annotations

import base64
from copy import deepcopy
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
    def __init__(
        self,
        message: str,
        *,
        kind: str = "definite",
        code: str | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.code = code
        self.request_id = request_id

    @property
    def outcome_unknown(self) -> bool:
        return self.kind == "unknown"

    @property
    def terminal(self) -> bool:
        return self.kind == "terminal"


def _is_terminal_stop_error(status_code: int, code: str, message: str) -> bool:
    if status_code == 404:
        return True
    value = f"{code} {message}".lower()
    return any(marker in value for marker in (
        "not found", "notfound", "not exist", "non-existent", "already stopped", "不存在", "已停止",
    ))


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
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(url, headers=headers, content=body_bytes)
        except httpx.RequestError as exc:
            raise ProviderError("火山 RTC 网络请求失败", kind="unknown", code=exc.__class__.__name__) from exc
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderError(
                f"火山 RTC 返回了非 JSON 响应：HTTP {response.status_code}",
                kind="unknown",
                code=f"HTTP_{response.status_code}",
            ) from exc
        metadata = payload.get("ResponseMetadata", {}) if isinstance(payload, dict) else {}
        error = metadata.get("Error") if isinstance(metadata, dict) else None
        if response.is_error or error:
            message = (error or {}).get("Message") or f"HTTP {response.status_code}"
            code = str((error or {}).get("Code") or f"HTTP_{response.status_code}")
            request_id = metadata.get("RequestId") or metadata.get("RequestID")
            kind = "terminal" if action == "StopVoiceChat" and _is_terminal_stop_error(response.status_code, code, message) else "definite"
            raise ProviderError(
                f"火山 RTC 调用失败：{message}",
                kind=kind,
                code=code,
                request_id=str(request_id) if request_id else None,
            )
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

    def _system_messages(
        self,
        tea_id: str,
        mode: str,
        user_context: str | None = None,
        camera_enabled: bool = False,
    ) -> list[str]:
        tea = catalog.require_tea(tea_id)
        guide = tea["brewingGuide"]
        factual_context = (
            f"当前茶：{tea['name']}；产区：{tea['region']}；茶类：{tea['teaType']}；"
            f"审核感官描述：{tea['officialDescription']}；建议器具：{guide['vessel']}；"
            f"建议水温：{guide['temperatureRange']}；建议时间：{guide['steepTime']}。"
        )
        visual_boundary = (
            "本次会话已开启画面辅助。你可以通过服务端视觉模型获得离散的冲泡动作候选。"
            "如果用户问你能否看到画面，要回答：‘我可以通过画面辅助判断动作，但不是连续观看视频。’"
            "只有收到服务端发来的视觉上下文后，才能提及对应动作；没有收到时要说还没有识别到明确动作。"
            if camera_enabled else
            "本次会话未开启画面辅助。你不能声称已经看到用户或茶具；如有需要，请用户重新开启带摄像头的陪泡会话。"
        )
        boundaries = (
            "你是 Tea-BTI 的茶伴，表达简短、温和、一次只给一到两个动作。"
            + visual_boundary
            + "你不能直接观看连续视频或自行解析原始画面；服务端可能告诉你一个尚未确认的动作候选，"
            "你必须先询问用户并等待用户回答‘对’或‘开始’，才能把它当作已发生。"
            "不能声称看到或知道水温、茶叶克数、水量、香气、滋味、茶叶品质或最佳出汤点；"
            "不能给出未经资料支持的精确值。"
            "如用户提供的信息不足，要使用‘如果’‘大约’并请用户确认。"
        )
        if mode == "brew":
            task = (
                "陪用户按准备、温杯、投茶、注水、浸泡、出汤或可以品饮、品饮反馈的顺序完成最多三泡。"
                "用户说暂停时只暂停聆听，现实中的浸泡计时继续；需要改变时间时引导说延长或现在出汤。"
                "每泡最多改变一个参数，并用自然语言说明这次为什么调整。"
            )
        else:
            task = "先接住用户的自然语言感受，再解释它可能对应的茶语；不要说用户喝错了。"
        messages = [boundaries, factual_context, task]
        if user_context:
            messages.append(
                "以下是服务端从用户真实行为中汇总的个性化上下文；"
                "只用来调整表达和建议，不要声称已经看见或亲身记得用户。"
                + user_context
            )
        return messages

    async def start(
        self, *, room_id: str, task_id: str, target_user_id: str,
        tea_id: str, mode: str, user_context: str | None = None,
        camera_enabled: bool = False,
    ) -> None:
        settings = self.settings
        try:
            template = json.loads(settings.rtc_voice_config_json)
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ProviderError("火山 RTC Voice Config 无效") from exc
        if not isinstance(template, dict):
            raise ProviderError("火山 RTC Voice Config 无效")

        body = deepcopy(template)
        body["AppId"] = settings.rtc_app_id
        body["RoomId"] = room_id
        body["TaskId"] = task_id
        body.pop("UserId", None)

        agent = body.setdefault("AgentConfig", {})
        config = body.setdefault("Config", {})
        if not isinstance(agent, dict) or not isinstance(config, dict):
            raise ProviderError("火山 RTC Voice Config 无效")

        # The new scheme binds ASR/TTS/model resources to the AI audio/video
        # application. Console exports may still include the legacy ASR field,
        # which the 2025-06-01 schema rejects.
        if settings.rtc_api_version == "2025-06-01":
            asr = config.get("ASRConfig")
            provider_params = asr.get("ProviderParams") if isinstance(asr, dict) else None
            if isinstance(provider_params, dict):
                provider_params.pop("ApiResourceId", None)

        agent.update({
            "TargetUserId": [target_user_id],
            "WelcomeMessage": "你好，我是茶伴。我们慢慢来，你现在准备到哪一步了？" if mode == "brew" else "先用你自己的话说说这一口，不需要懂茶语。",
            "UserId": "tea_companion",
            "EnableConversationStateCallback": True,
        })

        llm = config.setdefault("LLMConfig", {})
        if not isinstance(llm, dict) or not llm.get("ModelName"):
            raise ProviderError("火山 RTC Voice Config 缺少 ModelName")
        # Never inherit another product's role, camera, or tool configuration.
        llm["SystemMessages"] = self._system_messages(
            tea_id, mode, user_context, camera_enabled=camera_enabled,
        )
        llm.pop("VisionConfig", None)
        llm.pop("Tools", None)
        config.pop("FunctionCallingConfig", None)
        config.setdefault("SubtitleConfig", {"DisableRTSSubtitle": False, "SubtitleMode": 1})
        config.setdefault("InterruptMode", 0)
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
        except (httpx.HTTPError, KeyError, IndexError, ValueError, json.JSONDecodeError) as exc:
            kind = "unknown" if isinstance(exc, httpx.RequestError) else "definite"
            code = exc.__class__.__name__
            raise ProviderError("方舟茶语归一化暂不可用", kind=kind, code=code) from exc

    async def normalize_brew_feedback(self, text: str) -> str:
        allowed = ["too_light", "balanced", "too_strong", "bitter", "astringent", "too_hot", "too_cool", "other"]
        if self.settings.ai_mode == "mock" or not self.settings.ark_api_key:
            return "other"
        payload = {
            "model": self.settings.ark_text_model,
            "temperature": 0,
            "messages": [{
                "role": "user",
                "content": (
                    "只返回 JSON 对象 {\"feedback\": string}。"
                    f"feedback 只能从 {allowed} 中选择。"
                    "一句话同时有多个感受时，优先级是温度、浓淡苦涩、其他；不要推断用户没有说出的感受。"
                    f"用户原话：{text}"
                ),
            }],
        }
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
            feedback = json.loads(content).get("feedback")
            if feedback not in allowed:
                raise ValueError("模型未返回允许的陪泡反馈")
            return feedback
        except (httpx.HTTPError, KeyError, IndexError, ValueError, json.JSONDecodeError) as exc:
            kind = "unknown" if isinstance(exc, httpx.RequestError) else "definite"
            raise ProviderError("方舟陪泡反馈归一化暂不可用", kind=kind, code=exc.__class__.__name__) from exc


voice_provider = VoiceProvider()
taste_normalizer = TasteNormalizer()
