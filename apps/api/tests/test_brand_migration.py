from pathlib import Path

from app.db import migrate_legacy_default_database


def test_legacy_default_database_is_copied_once_and_kept_as_backup(tmp_path: Path):
    legacy = tmp_path / "shuacha.db"
    target = tmp_path / "tea-bti.db"
    legacy.write_bytes(b"legacy sqlite bytes")

    assert migrate_legacy_default_database(f"sqlite:///{target}") is True
    assert target.read_bytes() == b"legacy sqlite bytes"
    assert legacy.read_bytes() == b"legacy sqlite bytes"

    legacy.write_bytes(b"new legacy bytes must not overwrite")
    assert migrate_legacy_default_database(f"sqlite:///{target}") is False
    assert target.read_bytes() == b"legacy sqlite bytes"


def test_database_migration_only_applies_to_the_branded_default_name(tmp_path: Path):
    legacy = tmp_path / "shuacha.db"
    legacy.write_bytes(b"legacy")

    assert migrate_legacy_default_database(f"sqlite:///{tmp_path / 'custom.db'}") is False
    assert not (tmp_path / "custom.db").exists()
