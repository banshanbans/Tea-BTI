import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from app.config import get_settings


def test_profile_migration_creates_private_and_share_tables(tmp_path, monkeypatch):
    database = tmp_path / "profile-migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database}")
    get_settings.cache_clear()
    config = Config("alembic.ini")
    try:
        command.upgrade(config, "head")
        engine = sa.create_engine(f"sqlite:///{database}")
        inspector = sa.inspect(engine)
        assert {"tea_profiles", "profile_shares"} <= set(inspector.get_table_names())
        assert {column["name"] for column in inspector.get_columns("tea_profiles")} >= {
            "user_id", "display_name", "bio", "selected_tea_id", "source_feedback_id",
            "public_quote", "public_block_ids", "created_at", "updated_at",
        }
        indexes = inspector.get_indexes("profile_shares")
        assert any(index["unique"] and index["column_names"] == ["public_id"] for index in indexes)
    finally:
        get_settings.cache_clear()
