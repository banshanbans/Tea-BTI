"""add brew companion v2 state

Revision ID: e5c91a32b804
Revises: d4b58e90c721
Create Date: 2026-08-30 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e5c91a32b804"
down_revision: Union[str, None] = "d4b58e90c721"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brew_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("voice_session_id", sa.String(length=36), sa.ForeignKey("voice_sessions.id"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("anonymous_users.id"), nullable=False),
        sa.Column("tea_id", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("vessel", sa.String(length=80), nullable=False),
        sa.Column("temperature_c", sa.Integer(), nullable=True),
        sa.Column("temperature_range", sa.String(length=32), nullable=False),
        sa.Column("tea_amount", sa.String(length=40), nullable=False),
        sa.Column("water_volume_ml", sa.Integer(), nullable=False),
        sa.Column("current_stage", sa.String(length=24), nullable=False, server_default="prepare"),
        sa.Column("current_infusion", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_infusions", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("camera_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("timer_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pending_vision_event", sa.String(length=32), nullable=True),
        sa.Column("vision_streak_event", sa.String(length=32), nullable=True),
        sa.Column("vision_streak_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("vision_cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("adjustment_message", sa.String(length=160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("voice_session_id"),
    )
    op.create_index("ix_brew_runs_voice_session_id", "brew_runs", ["voice_session_id"])
    op.create_index("ix_brew_runs_user_id", "brew_runs", ["user_id"])
    op.create_index("ix_brew_runs_tea_id", "brew_runs", ["tea_id"])

    op.create_table(
        "brew_infusions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("brew_run_id", sa.String(length=36), sa.ForeignKey("brew_runs.id"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("planned_temperature_c", sa.Integer(), nullable=True),
        sa.Column("planned_duration_seconds", sa.Integer(), nullable=False),
        sa.Column("actual_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("feedback", sa.String(length=24), nullable=True),
        sa.Column("user_words", sa.Text(), nullable=True),
        sa.Column("adjustment_type", sa.String(length=24), nullable=True),
        sa.Column("adjustment_value", sa.Integer(), nullable=True),
        sa.Column("adjustment_reason", sa.String(length=160), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("brew_run_id", "number", name="uq_brew_infusion_run_number"),
    )
    op.create_index("ix_brew_infusions_brew_run_id", "brew_infusions", ["brew_run_id"])

    op.create_table(
        "brew_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("brew_run_id", sa.String(length=36), sa.ForeignKey("brew_runs.id"), nullable=False),
        sa.Column("client_event_id", sa.String(length=80), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("brew_run_id", "client_event_id", name="uq_brew_event_run_client"),
    )
    op.create_index("ix_brew_events_brew_run_id", "brew_events", ["brew_run_id"])


def downgrade() -> None:
    op.drop_index("ix_brew_events_brew_run_id", table_name="brew_events")
    op.drop_table("brew_events")
    op.drop_index("ix_brew_infusions_brew_run_id", table_name="brew_infusions")
    op.drop_table("brew_infusions")
    op.drop_index("ix_brew_runs_tea_id", table_name="brew_runs")
    op.drop_index("ix_brew_runs_user_id", table_name="brew_runs")
    op.drop_index("ix_brew_runs_voice_session_id", table_name="brew_runs")
    op.drop_table("brew_runs")
