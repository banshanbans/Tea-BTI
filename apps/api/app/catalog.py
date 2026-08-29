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


@dataclass(frozen=True)
class CardRecord:
    card_id: str
    tea_id: str
    asset: dict[str, Any]
    tea_visual: dict[str, Any]


class Catalog:
    def __init__(self) -> None:
        settings = get_settings()
        self.catalog_data = self._read(settings.catalog_path)
        self.seed_data = self._read(settings.mbti_seed_path)
        self.realm_data = self._read(settings.realm_catalog_path)
        self.manifest = self._read(settings.visual_manifest_path)
        self.teas = {tea["id"]: tea for tea in self.catalog_data["teas"]}
        self.visual_teas = {tea["tea_id"]: tea for tea in self.manifest["teas"]}
        self.realms = {realm["id"]: realm for realm in self.realm_data["realms"]}
        self.realms_by_tea = {realm["teaId"]: realm for realm in self.realm_data["realms"]}
        self.realm_assets: dict[str, dict[str, Any]] = {}
        self.cards: dict[str, CardRecord] = {}
        for tea in self.manifest["teas"]:
            for asset in tea["assets"]:
                if not asset.get("blind_safe"):
                    continue
                card_id = "card_" + hashlib.sha256(asset["id"].encode()).hexdigest()[:20]
                self.cards[card_id] = CardRecord(card_id, tea["tea_id"], asset, tea["visual_profile"])
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

    def blind_card(self, card_id: str) -> dict[str, Any]:
        card = self.require_card(card_id)
        copy = card.asset["card_copy"]
        return {
            "cardId": card.card_id,
            "headline": copy["headline"],
            "body": copy["body"],
            "tags": copy["tags"],
            "scene": copy["scene"],
            "visual": self._visual(card.tea_id, card.card_id),
        }

    def feed(self) -> list[dict[str, Any]]:
        return [self.blind_card(card_id) for card_id in self.cards]

    def tea_summary(self, tea_id: str) -> dict[str, Any]:
        tea = self.require_tea(tea_id)
        return {
            "teaId": tea["id"],
            "name": tea["name"],
            "region": tea["region"],
            "teaType": tea["teaType"],
            "professionalTags": tea["professionalTags"],
            "translation": "你留下的感觉，在茶的语言里大概接近：" + "、".join(tea["professionalTags"]),
            "visual": self._visual(tea_id),
        }

    def tea_detail(self, tea_id: str) -> dict[str, Any]:
        tea = self.require_tea(tea_id)
        realm = self.realm_for_tea(tea_id)
        return {
            **self.tea_summary(tea_id),
            "officialDescription": tea["officialDescription"],
            "process": tea["process"],
            "brewingGuide": tea["brewingGuide"],
            "evidenceRefIds": tea["evidenceRefIds"],
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
        strategy_name = self.seed_data["types"].get(mbti, "skip") if mbti else "skip"
        tea_ids = self.seed_data["strategies"][strategy_name]
        roles = ["mirror", "surprise", "contrast"]
        return [
            {
                "role": role,
                "roleLabel": ROLE_LABELS[role],
                "explanation": self.seed_data["roleCopy"][role],
                **self.tea_summary(tea_id),
                "tags": self.teas[tea_id]["professionalTags"],
            }
            for role, tea_id in zip(roles, tea_ids, strict=True)
        ]


catalog = Catalog()
