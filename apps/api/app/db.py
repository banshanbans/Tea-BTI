import os
import shutil
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def migrate_legacy_default_database(database_url: str) -> bool:
    """Copy the legacy default SQLite database once, keeping it as a backup."""
    url = make_url(database_url)
    if url.drivername != "sqlite" or not url.database:
        return False
    target = Path(url.database)
    if target.name != "tea-bti.db" or target.exists():
        return False
    legacy = target.with_name("shuacha.db")
    if not legacy.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.migrating")
    shutil.copy2(legacy, temporary)
    os.replace(temporary, target)
    return True


migrate_legacy_default_database(settings.database_url)
if settings.database_url.startswith("sqlite:///./"):
    relative = settings.database_url.removeprefix("sqlite:///./")
    Path(relative).parent.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
