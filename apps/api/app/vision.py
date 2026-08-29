from __future__ import annotations

import base64
import json

import httpx

from .brew import VISION_EVENTS
from .config import Settings, get_settings
from .voice import ProviderError


class VisionProvider:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def observe(self, image: bytes, stage: str) -> tuple[str, float]:
        if not self.settings.vision_real_enabled:
            raise ProviderError("视觉陪泡暂不可用", code="VISION_UNAVAILABLE")
        encoded = base64.b64encode(image).decode()
        prompt = (
            "只返回 JSON 对象 {\"event\": string, \"confidence\": number}，confidence 范围为 0 到 1。"
            f"event 只能是 {list(VISION_EVENTS)}。当前冲泡阶段是 {stage}。"
            "只判断画面中是否明确出现：已投茶、正在注水、正在出汤、画面被遮挡。"
            "不要判断水温、克数、水量、香气、滋味、品质或最佳出汤点；不明确就返回 none。"
        )
        payload = {
            "model": self.settings.ark_vision_model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}},
                ],
            }],
            "temperature": 0,
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
            parsed = json.loads(content)
            event = parsed.get("event")
            confidence = float(parsed.get("confidence", 0))
            if event not in VISION_EVENTS:
                raise ValueError("视觉模型返回了不允许的事件")
            if not 0 <= confidence <= 1:
                raise ValueError("视觉模型返回了无效置信度")
            return event, confidence
        except (httpx.HTTPError, KeyError, IndexError, ValueError, json.JSONDecodeError) as exc:
            kind = "unknown" if isinstance(exc, httpx.RequestError) else "definite"
            raise ProviderError("视觉陪泡暂不可用", kind=kind, code=exc.__class__.__name__) from exc


vision_provider = VisionProvider()
