from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from app.config import get_settings


def test_migration_backfills_legacy_realm_unlock(tmp_path, monkeypatch):
    database = tmp_path / "realm-migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database}")
    get_settings.cache_clear()
    config = Config("alembic.ini")
    try:
        command.upgrade(config, "5718ea061dd5")

        engine = sa.create_engine(f"sqlite:///{database}")
        now = datetime.now(timezone.utc)
        with engine.begin() as connection:
            connection.execute(sa.text("""
                INSERT INTO anonymous_users (id, mbti, onboarding_completed, created_at)
                VALUES (:id, NULL, 0, :now)
            """), {"id": "legacy-user", "now": now})
            connection.execute(sa.text("""
                INSERT INTO passport_entries (
                    id, user_id, tea_id, saved, brewed, tasted, realm_unlocked,
                    favorite_infusion, user_description, normalized_tags, first_drunk_at, updated_at
                ) VALUES (
                    :id, :user_id, 'duyun-maojian', 0, 1, 1, 1,
                    NULL, NULL, '[]', :now, :now
                )
            """), {"id": "legacy-passport", "user_id": "legacy-user", "now": now})

        command.upgrade(config, "head")
        with engine.connect() as connection:
            progress = connection.execute(sa.text("SELECT * FROM realm_progress WHERE user_id='legacy-user'")).mappings().one()
            specimens = connection.execute(sa.text("SELECT * FROM realm_specimens WHERE user_id='legacy-user'")).mappings().all()
        assert progress["realm_id"] == "duyun-maojian-mist-bud"
        assert progress["current_scene"] == "passport-specimen"
        assert progress["completed_at"] is not None
        assert progress["first_completion_mode"] == "interactive"
        assert progress["interactive_completed_at"] is not None
        assert progress["reading_completed_at"] is None
        assert len(specimens) == 1
        assert specimens[0]["specimen_id"] == "duyun-maojian-pekoe"
    finally:
        get_settings.cache_clear()
