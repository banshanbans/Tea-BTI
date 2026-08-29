import json
from pathlib import Path

from app.main import app


def test_openapi_snapshot_matches_application_and_generated_types_exist():
    repository_root = Path(__file__).resolve().parents[3]
    snapshot_path = repository_root / "packages" / "contracts" / "openapi.json"
    generated_types = repository_root / "packages" / "contracts" / "src" / "schema.ts"
    assert json.loads(snapshot_path.read_text(encoding="utf-8")) == app.openapi()
    assert "export interface components" in generated_types.read_text(encoding="utf-8")


def test_blind_card_contract_has_no_identity_fields_and_errors_are_documented():
    spec = app.openapi()
    properties = spec["components"]["schemas"]["BlindCardResponse"]["properties"]
    assert "teaId" not in properties
    assert "name" not in properties
    assert {"cardId", "headline", "body", "tags", "scene", "visual"} <= set(properties)
    responses = spec["paths"]["/api/v1/feed"]["get"]["responses"]
    assert responses["401"]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")


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
