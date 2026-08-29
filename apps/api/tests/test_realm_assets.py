import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_manifest_v3_has_eight_presentation_and_detail_assets_with_provenance():
    manifest = read_json(ROOT / "assets/tea-visuals/manifest.json")
    schema = read_json(ROOT / "assets/tea-visuals/manifest.schema.json")
    prompts = read_json(ROOT / "assets/tea-visuals/prompts.json")
    realm_catalog = read_json(ROOT / "apps/api/data/realm-catalog.json")

    assert manifest["schema_version"] == 3
    assert schema["properties"]["schema_version"]["const"] == 3
    assert len(manifest["teas"]) == 8
    assert len({tea["tea_id"] for tea in manifest["teas"]}) == 8
    presentation_assets = [tea["assets"][0] for tea in manifest["teas"]]
    detail_assets = [tea["detail_asset"] for tea in manifest["teas"]]
    assert all(asset["active"] and asset["role"] == "presentation" for asset in presentation_assets)
    assert all(asset["rights_state"] == "demo_only" for asset in presentation_assets)
    assert all(asset["role"] == "detail" and asset["rights_state"] == "unknown" for asset in detail_assets)
    for asset in [*presentation_assets, *detail_assets]:
        master = ROOT / asset["master_path"]
        media = ROOT / asset["media_path"]
        assert master.is_file()
        assert media.is_file()
        assert asset["source_url"]
        assert hashlib.sha256(master.read_bytes()).hexdigest() == asset["master_sha256"]
        assert hashlib.sha256(media.read_bytes()).hexdigest() == asset["sha256"]
        assert asset["master_width"] > 0 and asset["master_height"] > 0
        assert asset["media_width"] > 0 and asset["media_height"] > 0

    for asset in detail_assets:
        original = ROOT / asset["original_path"]
        assert original.is_file()
        assert hashlib.sha256(original.read_bytes()).hexdigest() == asset["original_sha256"]

    edited = {asset["id"]: asset for asset in detail_assets if asset["edit_chain"]}
    assert set(edited) == {"meitan-cuiya-detail", "fanjingshan-matcha-detail"}
    assert all(asset["edit_chain"][0]["operation"] == "watermark_removal" for asset in edited.values())
    assert all(asset["edit_chain"][0]["verification"]["outside_scope_pixel_difference"] == "0 (0)" for asset in edited.values())


def test_realm_assets_keep_their_rights_and_fact_boundaries():
    manifest = read_json(ROOT / "assets/tea-visuals/manifest.json")
    prompts = read_json(ROOT / "assets/tea-visuals/prompts.json")
    realm_catalog = read_json(ROOT / "apps/api/data/realm-catalog.json")

    prompt_ids = {item["prompt_id"] for item in prompts["assets"]}
    assets = [asset for tea in manifest["teas"] for asset in tea["realm_assets"]]
    assert len({asset["id"] for asset in assets}) == len(assets) == 14

    for asset in assets:
        master = ROOT / asset["master_path"]
        media = ROOT / asset["media_path"]
        assert master.is_file()
        assert media.is_file()
        if asset.get("master_sha256"):
            assert hashlib.sha256(master.read_bytes()).hexdigest() == asset["master_sha256"]
        assert hashlib.sha256(media.read_bytes()).hexdigest() == asset["sha256"]
        assert asset["master_width"] > 0 and asset["master_height"] > 0
        assert asset["media_width"] > 0 and asset["media_height"] > 0
        if asset["source_kind"] == "ai_generated":
            assert asset["authenticity_state"] == "synthetic_demo"
            assert asset["rights_state"] == "demo_only"
            assert asset["evidence_ref_ids"] == []
            assert asset["prompt_id"] in prompt_ids

    dry_tea = next(asset for asset in assets if asset["role"] == "dry_tea_reveal")
    assert dry_tea["source_kind"] == "open_access_figure"
    assert dry_tea["authenticity_state"] == "documentary"
    assert dry_tea["rights_state"] == "open_license"
    assert dry_tea["evidence_ref_ids"] == ["food-chemistry-x-2026-figure-7"]

    asset_ids = {asset["id"] for asset in assets}
    imported_roles = {"liquor_base", "liquor_ripple", "bud_single", "bud_leaf", "bud_open", "bud_stem"}
    imported_assets = [asset for asset in assets if asset["role"] in imported_roles]
    assert {asset["role"] for asset in imported_assets} == imported_roles
    assert sum((ROOT / asset["media_path"]).stat().st_size for asset in imported_assets) <= 1_500_000
    teacher_roles = {"teacher_observe", "teacher_correction", "teacher_explain"}
    teacher_assets = [asset for asset in assets if asset["role"] in teacher_roles]
    assert {asset["role"] for asset in teacher_assets} == teacher_roles
    assert sum((ROOT / asset["media_path"]).stat().st_size for asset in teacher_assets) <= 500_000
    realm = realm_catalog["realms"][0]
    assert all(asset_id in asset_ids for scene in realm["scenes"] for asset_id in scene["assetIds"])
    debt = next(item for item in realm["evidenceRefs"] if item["id"] == "duyun-53000-plus")
    assert debt["status"] == "debt"
