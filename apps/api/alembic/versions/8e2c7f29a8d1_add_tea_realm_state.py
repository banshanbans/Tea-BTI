"""add tea realm state

Revision ID: 8e2c7f29a8d1
Revises: 5718ea061dd5
Create Date: 2026-08-28 14:30:00
"""

import uuid
from datetime import timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "8e2c7f29a8d1"
down_revision: Union[str, None] = "5718ea061dd5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


REALM_ID = "duyun-maojian-mist-bud"
TEA_ID = "duyun-maojian"
SPECIMEN_ID = "duyun-maojian-pekoe"
SCENES = [
    "liquor-entry", "mist-mountain", "pick-bud", "wok-craft",
    "human-judgment", "real-tea-reveal", "passport-specimen",
]


def upgrade() -> None:
    op.add_column("analytics_events", sa.Column("client_event_id", sa.String(length=80), nullable=True))
    op.create_index(
        "uq_analytics_user_client_event",
        "analytics_events",
        ["user_id", "client_event_id"],
        unique=True,
    )
    op.create_table(
        "realm_progress",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("realm_id", sa.String(length=80), nullable=False),
        sa.Column("tea_id", sa.String(length=80), nullable=False),
        sa.Column("current_scene", sa.String(length=40), nullable=False),
        sa.Column("completed_scenes", sa.JSON(), nullable=False),
        sa.Column("interaction_mode", sa.String(length=24), nullable=True),
        sa.Column("total_elapsed_ms", sa.Integer(), nullable=False),
        sa.Column("replay_count", sa.Integer(), nullable=False),
        sa.Column("used_taste_words", sa.Boolean(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["anonymous_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "realm_id", name="uq_realm_progress_user_realm"),
    )
    op.create_index(op.f("ix_realm_progress_user_id"), "realm_progress", ["user_id"], unique=False)
    op.create_index(op.f("ix_realm_progress_realm_id"), "realm_progress", ["realm_id"], unique=False)
    op.create_index(op.f("ix_realm_progress_tea_id"), "realm_progress", ["tea_id"], unique=False)
    op.create_table(
        "realm_specimens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("realm_id", sa.String(length=80), nullable=False),
        sa.Column("tea_id", sa.String(length=80), nullable=False),
        sa.Column("specimen_id", sa.String(length=80), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["anonymous_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "realm_id", "specimen_id", name="uq_realm_specimen_user_realm_item"),
    )
    op.create_index(op.f("ix_realm_specimens_user_id"), "realm_specimens", ["user_id"], unique=False)
    op.create_index(op.f("ix_realm_specimens_realm_id"), "realm_specimens", ["realm_id"], unique=False)
    op.create_index(op.f("ix_realm_specimens_tea_id"), "realm_specimens", ["tea_id"], unique=False)

    connection = op.get_bind()
    passport_entries = sa.table(
        "passport_entries",
        sa.column("user_id", sa.String),
        sa.column("tea_id", sa.String),
        sa.column("realm_unlocked", sa.Boolean),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    progress_table = sa.table(
        "realm_progress",
        sa.column("id", sa.String), sa.column("user_id", sa.String),
        sa.column("realm_id", sa.String), sa.column("tea_id", sa.String),
        sa.column("current_scene", sa.String), sa.column("completed_scenes", sa.JSON),
        sa.column("interaction_mode", sa.String), sa.column("total_elapsed_ms", sa.Integer),
        sa.column("replay_count", sa.Integer), sa.column("used_taste_words", sa.Boolean),
        sa.column("started_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("completed_at", sa.DateTime(timezone=True)),
    )
    specimen_table = sa.table(
        "realm_specimens",
        sa.column("id", sa.String), sa.column("user_id", sa.String),
        sa.column("realm_id", sa.String), sa.column("tea_id", sa.String),
        sa.column("specimen_id", sa.String), sa.column("collected_at", sa.DateTime(timezone=True)),
    )
    legacy_rows = connection.execute(sa.select(
        passport_entries.c.user_id,
        passport_entries.c.updated_at,
    ).where(
        passport_entries.c.tea_id == TEA_ID,
        passport_entries.c.realm_unlocked.is_(True),
    )).all()
    for row in legacy_rows:
        completed_at = row.updated_at
        if completed_at and completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        connection.execute(progress_table.insert().values(
            id=str(uuid.uuid4()), user_id=row.user_id, realm_id=REALM_ID, tea_id=TEA_ID,
            current_scene=SCENES[-1], completed_scenes=SCENES, interaction_mode="pointer",
            total_elapsed_ms=0, replay_count=0, used_taste_words=False,
            started_at=completed_at, updated_at=completed_at, completed_at=completed_at,
        ))
        connection.execute(specimen_table.insert().values(
            id=str(uuid.uuid4()), user_id=row.user_id, realm_id=REALM_ID, tea_id=TEA_ID,
            specimen_id=SPECIMEN_ID, collected_at=completed_at,
        ))


def downgrade() -> None:
    op.drop_index(op.f("ix_realm_specimens_tea_id"), table_name="realm_specimens")
    op.drop_index(op.f("ix_realm_specimens_realm_id"), table_name="realm_specimens")
    op.drop_index(op.f("ix_realm_specimens_user_id"), table_name="realm_specimens")
    op.drop_table("realm_specimens")
    op.drop_index(op.f("ix_realm_progress_tea_id"), table_name="realm_progress")
    op.drop_index(op.f("ix_realm_progress_realm_id"), table_name="realm_progress")
    op.drop_index(op.f("ix_realm_progress_user_id"), table_name="realm_progress")
    op.drop_table("realm_progress")
    op.drop_index("uq_analytics_user_client_event", table_name="analytics_events")
    with op.batch_alter_table("analytics_events") as batch_op:
        batch_op.drop_column("client_event_id")
