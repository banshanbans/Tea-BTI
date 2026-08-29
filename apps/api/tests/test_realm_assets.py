import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_realm_manifest_v2_paths_hashes_rights_and_fact_boundaries():
    manifest = read_json(ROOT / "assets/tea-visuals/manifest.json")
    schema = read_json(ROOT / "assets/tea-visuals/manifest.schema.json")
    prompts = read_json(ROOT / "assets/tea-visuals/prompts.json")
    realm_catalog = read_json(ROOT / "apps/api/data/realm-catalog.json")

    assert manifest["schema_version"] == 2
    assert schema["properties"]["schema_version"]["const"] == 2
    prompt_ids = {item["prompt_id"] for item in prompts["assets"]}
    assets = [asset for tea in manifest["teas"] for asset in tea["realm_assets"]]
    assert len({asset["id"] for asset in assets}) == len(assets) == 5

    for asset in assets:
        master = ROOT / asset["master_path"]
        media = ROOT / asset["media_path"]
        assert master.is_file()
        assert media.is_file()
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
    realm = realm_catalog["realms"][0]
    assert all(asset_id in asset_ids for scene in realm["scenes"] for asset_id in scene["assetIds"])
    debt = next(item for item in realm["evidenceRefs"] if item["id"] == "duyun-53000-plus")
    assert debt["status"] == "debt"
