from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import get_settings


ROLE_LABELS = {
    "mirror": "最像你",
    "surprise": "可能让你惊喜",
    "contrast": "和你反差但值得试",
}

TEA_BTI_CODES = {
    first + second + third + fourth
    for first in "FM"
    for second in "LR"
    for third in "ST"
    for fourth in "EC"
}


@dataclass(frozen=True)
class CardRecord:
    card_id: str
    tea_id: str
    asset: dict[str, Any]
    tea_visual: dict[str, Any]
    active: bool


class Catalog:
    def __init__(self) -> None:
        settings = get_settings()
        self.catalog_data = self._read(settings.catalog_path)
        self.seed_data = self._read(settings.mbti_seed_path)
        self.tea_bti_data = self._read(settings.tea_bti_persona_path)
        self.realm_data = self._read(settings.realm_catalog_path)
        self.manifest = self._read(settings.visual_manifest_path)
        if self.catalog_data.get("schemaVersion") != 2:
            raise ValueError("Unsupported tea catalog schema version")
        if self.seed_data.get("schemaVersion") != 2:
            raise ValueError("Unsupported MBTI seed schema version")
        if self.tea_bti_data.get("schemaVersion") != 2:
            raise ValueError("Unsupported Tea-BTI persona config schema version")
        persona_records = self.tea_bti_data.get("personas", [])
        persona_codes = [record.get("code") for record in persona_records]
        if len(persona_codes) != len(TEA_BTI_CODES) or set(persona_codes) != TEA_BTI_CODES:
            raise ValueError("Tea-BTI persona config must contain each of the 16 codes exactly once")
        if any(
            not isinstance(record.get(field), str) or not record[field].strip()
            for record in persona_records
            for field in ("code", "name", "summary")
        ):
            raise ValueError("Tea-BTI persona code, name and summary must be non-empty strings")
        self.tea_bti_personas = {record["code"]: record for record in persona_records}
        self._validate_tea_bti_persona_details()
        self.teas = {tea["id"]: tea for tea in self.catalog_data["teas"]}
        if len(self.teas) != 8:
            raise ValueError("Tea catalog must contain exactly eight teas")
        if set(self.seed_data.get("matches", {})) != {
            "INFP", "INFJ", "ISFP", "ISFJ", "ENFP", "ENFJ", "ESFP", "ESFJ",
            "INTP", "INTJ", "ISTP", "ISTJ", "ENTP", "ENTJ", "ESTP", "ESTJ",
        }:
            raise ValueError("MBTI seed config must contain each of the 16 types exactly once")
        for tea_ids in [*self.seed_data["matches"].values(), self.seed_data["skip"]]:
            if len(tea_ids) != 3 or len(set(tea_ids)) != 3 or any(tea_id not in self.teas for tea_id in tea_ids):
                raise ValueError("Each MBTI seed must contain three distinct catalog teas")
        self.visual_teas = {tea["tea_id"]: tea for tea in self.manifest["teas"]}
        if set(self.visual_teas) != set(self.teas):
            raise ValueError("Visual manifest and tea catalog must contain the same teas")
        self.realms = {realm["id"]: realm for realm in self.realm_data["realms"]}
        self.realms_by_tea = {realm["teaId"]: realm for realm in self.realm_data["realms"]}
        self.realm_assets: dict[str, dict[str, Any]] = {}
        self.cards: dict[str, CardRecord] = {}
        self.active_card_ids: list[str] = []
        for tea in self.manifest["teas"]:
            for asset in [*tea["assets"], *tea.get("legacy_assets", [])]:
                card_id = "card_" + hashlib.sha256(asset["id"].encode()).hexdigest()[:20]
                active = bool(asset.get("active"))
                self.cards[card_id] = CardRecord(card_id, tea["tea_id"], asset, tea["visual_profile"], active)
                if active:
                    self.active_card_ids.append(card_id)
            for asset in tea.get("realm_assets", []):
                self.realm_assets[asset["id"]] = asset

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def require_tea(self, tea_id: str) -> dict[str, Any]:
        if tea_id not in self.teas:
            raise KeyError(tea_id)
        return self.teas[tea_id]

    def require_card(self, card_id: str) -> CardRecord:
        if card_id not in self.cards:
            raise KeyError(card_id)
        return self.cards[card_id]

    @staticmethod
    def _require_non_empty_text(value: Any, path: str) -> None:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Tea-BTI persona {path} must be a non-empty string")

    @classmethod
    def _validate_dialogue(cls, value: Any, path: str) -> None:
        if not isinstance(value, list) or len(value) < 2:
            raise ValueError(f"Tea-BTI persona {path} must contain at least two dialogue lines")
        for index, line in enumerate(value):
            if not isinstance(line, dict):
                raise ValueError(f"Tea-BTI persona {path}[{index}] must be an object")
            cls._require_non_empty_text(line.get("speaker"), f"{path}[{index}].speaker")
            cls._require_non_empty_text(line.get("text"), f"{path}[{index}].text")

    def _validate_tea_bti_persona_details(self) -> None:
        banned_patterns = (
            ("不是……而是……", r"不是.{0,120}而是"),
            ("天生如此", r"天生如此"),
            ("匹配度", r"匹配度"),
            ("匹配百分比", r"\d+(?:\.\d+)?%"),
            ("确诊", r"确诊"),
            ("病症", r"病症"),
            ("虚构停留时长", r"停留\s*\d+\s*秒"),
            ("虚构历史杯数", r"过去\s*\d+\s*杯"),
            ("虚构跳过杯数", r"跳过了\s*\d+\s*杯"),
            ("虚构出现次数", r"出现了?\s*\d+\s*次"),
        )
        import re

        for code, record in self.tea_bti_personas.items():
            detail = record.get("detail")
            if not isinstance(detail, dict):
                raise ValueError(f"Tea-BTI persona {code}.detail must be an object")
            for field in ("punchline", "neverSay"):
                self._require_non_empty_text(detail.get(field), f"{code}.detail.{field}")

            symptoms = detail.get("symptoms")
            if not isinstance(symptoms, list) or len(symptoms) != 5:
                raise ValueError(f"Tea-BTI persona {code}.detail.symptoms must contain exactly five items")
            for index, item in enumerate(symptoms):
                self._require_non_empty_text(item, f"{code}.detail.symptoms[{index}]")

            contrasts = detail.get("contrasts")
            if not isinstance(contrasts, list) or len(contrasts) != 4:
                raise ValueError(f"Tea-BTI persona {code}.detail.contrasts must contain exactly four items")
            for index, item in enumerate(contrasts):
                if not isinstance(item, dict):
                    raise ValueError(f"Tea-BTI persona {code}.detail.contrasts[{index}] must be an object")
                self._require_non_empty_text(item.get("claim"), f"{code}.detail.contrasts[{index}].claim")
                self._require_non_empty_text(item.get("reality"), f"{code}.detail.contrasts[{index}].reality")

            scenes = detail.get("scenes")
            if not isinstance(scenes, list) or len(scenes) != 3:
                raise ValueError(f"Tea-BTI persona {code}.detail.scenes must contain exactly three items")
            for index, scene in enumerate(scenes):
                if not isinstance(scene, dict):
                    raise ValueError(f"Tea-BTI persona {code}.detail.scenes[{index}] must be an object")
                self._require_non_empty_text(scene.get("title"), f"{code}.detail.scenes[{index}].title")
                self._validate_dialogue(scene.get("lines"), f"{code}.detail.scenes[{index}].lines")

            enemies = detail.get("enemies")
            if not isinstance(enemies, list) or len(enemies) != 3:
                raise ValueError(f"Tea-BTI persona {code}.detail.enemies must contain exactly three items")
            for index, enemy in enumerate(enemies):
                if not isinstance(enemy, dict):
                    raise ValueError(f"Tea-BTI persona {code}.detail.enemies[{index}] must be an object")
                self._require_non_empty_text(enemy.get("trigger"), f"{code}.detail.enemies[{index}].trigger")
                self._require_non_empty_text(enemy.get("reaction"), f"{code}.detail.enemies[{index}].reaction")

            self._validate_dialogue(detail.get("signatureMoment"), f"{code}.detail.signatureMoment")
            chemistry = detail.get("chemistry")
            if not isinstance(chemistry, dict):
                raise ValueError(f"Tea-BTI persona {code}.detail.chemistry must be an object")
            partner_code = chemistry.get("partnerCode")
            if partner_code not in self.tea_bti_personas or partner_code == code:
                raise ValueError(f"Tea-BTI persona {code} must reference a known, different CP")
            self._validate_dialogue(chemistry.get("lines"), f"{code}.detail.chemistry.lines")
            self._require_non_empty_text(chemistry.get("summary"), f"{code}.detail.chemistry.summary")

            searchable = json.dumps(detail, ensure_ascii=False)
            for label, pattern in banned_patterns:
                if re.search(pattern, searchable):
                    raise ValueError(f"Tea-BTI persona {code} contains banned expression: {label}")

        for code, record in self.tea_bti_personas.items():
            partner_code = record["detail"]["chemistry"]["partnerCode"]
            reciprocal = self.tea_bti_personas[partner_code]["detail"]["chemistry"]["partnerCode"]
            if reciprocal != code:
                raise ValueError(f"Tea-BTI persona CP mapping must be reciprocal: {code} -> {partner_code}")

    def require_tea_bti_persona(self, code: str) -> dict[str, Any]:
        if code not in self.tea_bti_personas:
            raise KeyError(code)
        return self.tea_bti_personas[code]

    def require_realm(self, realm_id: str) -> dict[str, Any]:
        if realm_id not in self.realms:
            raise KeyError(realm_id)
        return self.realms[realm_id]

    def realm_for_tea(self, tea_id: str) -> dict[str, Any] | None:
        return self.realms_by_tea.get(tea_id)

    def require_realm_asset(self, asset_id: str) -> dict[str, Any]:
        if asset_id not in self.realm_assets:
            raise KeyError(asset_id)
        return self.realm_assets[asset_id]

    def media_path(self, card_id: str) -> Path:
        card = self.require_card(card_id)
        return get_settings().repository_root / card.asset["media_path"]

    def detail_media_path(self, tea_id: str) -> Path:
        self.require_tea(tea_id)
        return get_settings().repository_root / self.visual_teas[tea_id]["detail_asset"]["media_path"]

    def realm_media_path(self, asset_id: str) -> Path:
        asset = self.require_realm_asset(asset_id)
        return get_settings().repository_root / asset["media_path"]

    def realm_asset(self, asset_id: str) -> dict[str, Any]:
        asset = self.require_realm_asset(asset_id)
        return {
            "assetId": asset["id"],
            "role": asset["role"],
            "url": f"/api/v1/media/realm/{asset['id']}",
            "sourceKind": asset["source_kind"],
            "authenticityState": asset["authenticity_state"],
            "rightsState": asset["rights_state"],
            "rightsNote": asset["rights_note"],
            "credit": asset.get("credit"),
            "evidenceRefIds": asset.get("evidence_ref_ids", []),
        }

    def _visual(self, tea_id: str, card_id: str | None = None) -> dict[str, Any]:
        visual_tea = self.visual_teas[tea_id]
        profile = visual_tea["visual_profile"]
        if card_id:
            card = self.require_card(card_id)
        else:
            primary_id = profile["primary_anchor_asset_id"]
            card = next(record for record in self.cards.values() if record.asset["id"] == primary_id)
        return {
            "url": f"/api/v1/media/cards/{card.card_id}",
            "objectPosition": card.asset["crop_strategy"]["object_position"],
            "structureColor": profile["structure_color"],
            "abstractForm": profile["abstract_form"],
            "atmosphereCue": profile["atmosphere_cue"],
            "overlay": profile["overlay"],
        }

    def feed_card(self, card_id: str) -> dict[str, Any]:
        card = self.require_card(card_id)
        tea = self.require_tea(card.tea_id)
        copy = card.asset["card_copy"]
        return {
            "cardId": card.card_id,
            "teaId": tea["id"],
            "name": tea["name"],
            "region": tea["region"],
            "teaType": tea["teaType"],
            "personalityKeywords": tea["personalityKeywords"],
            "headline": copy["headline"],
            "body": copy["body"],
            "tags": copy["tags"],
            "scene": copy["scene"],
            "visual": self._visual(card.tea_id, card.card_id),
        }

    def feed(self) -> list[dict[str, Any]]:
        return [self.feed_card(card_id) for card_id in self.active_card_ids]

    def detail_visual(self, tea_id: str) -> dict[str, Any]:
        asset = self.visual_teas[tea_id]["detail_asset"]
        return {
            "url": f"/api/v1/media/details/{tea_id}",
            "objectPosition": asset["object_position"],
            "alt": f"{self.teas[tea_id]['name']}实拍参考图",
            "rightsState": asset["rights_state"],
            "rightsNote": asset["rights_note"],
            "credit": asset["credit"],
            "sourceUrl": asset["source_url"],
        }

    def tea_summary(self, tea_id: str) -> dict[str, Any]:
        tea = self.require_tea(tea_id)
        return {
            "teaId": tea["id"],
            "name": tea["name"],
            "region": tea["region"],
            "teaType": tea["teaType"],
            "professionalTags": tea["professionalTags"],
            "personalityKeywords": tea["personalityKeywords"],
            "translation": "你留下的感觉，在茶的语言里大概接近：" + "、".join(tea["professionalTags"]),
            "visual": self._visual(tea_id),
        }

    def tea_detail(self, tea_id: str) -> dict[str, Any]:
        tea = self.require_tea(tea_id)
        realm = self.realm_for_tea(tea_id)
        return {
            **self.tea_summary(tea_id),
            "detailVisual": self.detail_visual(tea_id),
            "representativeFeatures": tea["representativeFeatures"],
            "aromaAndTaste": tea["aromaAndTaste"],
            "officialDescription": tea["officialDescription"],
            "process": tea["process"],
            "brewingGuide": tea["brewingGuide"],
            "evidenceRefIds": [item["id"] for item in tea["evidenceRefs"]],
            "evidenceRefs": tea["evidenceRefs"],
            "realmId": realm["id"] if realm else None,
        }

    def realm_definition(self, realm_id: str) -> dict[str, Any]:
        realm = self.require_realm(realm_id)
        asset_ids = list(dict.fromkeys(asset_id for scene in realm["scenes"] for asset_id in scene["assetIds"]))
        return {
            "realmId": realm["id"],
            "teaId": realm["teaId"],
            "title": realm["title"],
            "subtitle": realm["subtitle"],
            "regionId": realm["regionId"],
            "regionLabel": realm["regionLabel"],
            "sceneOrder": [scene["id"] for scene in realm["scenes"]],
            "scenes": realm["scenes"],
            "assets": [self.realm_asset(asset_id) for asset_id in asset_ids],
            "specimen": realm["specimen"],
            "evidenceRefs": realm["evidenceRefs"],
        }

    def seed_batch(self, mbti: str | None) -> list[dict[str, Any]]:
        tea_ids = self.seed_data["matches"].get(mbti, self.seed_data["skip"]) if mbti else self.seed_data["skip"]
        roles = ["mirror", "surprise", "contrast"]
        return [
            {
                "role": role,
                "roleLabel": ROLE_LABELS[role],
                "explanation": self.seed_data["roleCopy"][role].format(
                    keywords="、".join(self.teas[tea_id]["personalityKeywords"][:2]),
                ),
                **self.tea_summary(tea_id),
                "tags": self.teas[tea_id]["professionalTags"],
            }
            for role, tea_id in zip(roles, tea_ids, strict=True)
        ]


catalog = Catalog()
