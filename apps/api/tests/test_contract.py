import json
from pathlib import Path

from app.main import app


def test_openapi_snapshot_matches_application_and_generated_types_exist():
    repository_root = Path(__file__).resolve().parents[3]
    snapshot_path = repository_root / "packages" / "contracts" / "openapi.json"
    generated_types = repository_root / "packages" / "contracts" / "src" / "schema.ts"
    assert json.loads(snapshot_path.read_text(encoding="utf-8")) == app.openapi()
    assert "export interface components" in generated_types.read_text(encoding="utf-8")


def test_feed_card_contract_exposes_identity_and_errors_are_documented():
    spec = app.openapi()
    properties = spec["components"]["schemas"]["FeedCardResponse"]["properties"]
    assert {"cardId", "teaId", "name", "region", "teaType", "personalityKeywords", "headline", "body", "tags", "scene", "visual"} <= set(properties)
    responses = spec["paths"]["/api/v1/feed"]["get"]["responses"]
    assert responses["401"]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")


def test_tea_detail_contract_has_real_photo_content_and_structured_brewing():
    spec = app.openapi()
    assert "/api/v1/media/details/{tea_id}" in spec["paths"]
    assert "image/webp" in spec["paths"]["/api/v1/media/details/{tea_id}"]["get"]["responses"]["200"]["content"]
    properties = spec["components"]["schemas"]["TeaDetailResponse"]["properties"]
    assert {"detailVisual", "representativeFeatures", "aromaAndTaste", "personalityKeywords", "evidenceRefs"} <= set(properties)
    brewing = spec["components"]["schemas"]["BrewingGuideResponse"]["properties"]
    assert {"vessel", "temperatureRange", "teaAmount", "waterVolume", "method", "steepTime", "notes"} <= set(brewing)


def test_tea_bti_contract_exposes_the_reviewed_persona_summary():
    schema = app.openapi()["components"]["schemas"]["TeaBtiResponse"]
    properties = schema["properties"]
    assert {"code", "personaName", "personaSummary", "formationProgress", "personaDetail", "behaviorEvidence", "axes", "evidence"} <= set(properties)
    assert "formationProgress" in schema["required"]
    assert properties["personaSummary"]["anyOf"][-1]["type"] == "null"
    assert properties["formationProgress"]["anyOf"][-1]["type"] == "null"
    assert properties["personaDetail"]["anyOf"][-1]["type"] == "null"
    progress = app.openapi()["components"]["schemas"]["TeaBtiFormationProgress"]
    assert progress["properties"]["swipesRequired"]["const"] == 2
    detail = app.openapi()["components"]["schemas"]["TeaBtiPersonaDetail"]["properties"]
    assert {"punchline", "symptoms", "contrasts", "scenes", "enemies", "signatureMoment", "neverSay", "chemistry"} == set(detail)
    behavior = app.openapi()["components"]["schemas"]["TeaBtiBehaviorEvidence"]["properties"]
    assert {"kind", "tea", "userWords", "infusionNumber"} == set(behavior)


def test_public_profile_uses_a_separate_privacy_schema():
    spec = app.openapi()
    public_properties = spec["components"]["schemas"]["PublicTeaProfileResponse"]["properties"]
    assert set(public_properties) == {
        "publicId", "publicBlockIds", "identity", "myTea", "myWords", "teaPassport", "updatedAt",
    }
    passport_item = spec["components"]["schemas"]["PublicProfilePassportItemResponse"]["properties"]
    assert set(passport_item) == {"tea", "saved", "brewed", "tasted", "realmUnlocked", "specimens"}
    forbidden = {"userId", "feedbackId", "firstDrunkAt", "favoriteInfusion", "userDescription", "collectedAt"}
    assert forbidden.isdisjoint(public_properties)
    assert forbidden.isdisjoint(passport_item)
