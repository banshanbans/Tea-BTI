"""harden voice session lifecycle

Revision ID: c7a94e21f630
Revises: b1f73d9c4a26
Create Date: 2026-08-29 12:00:00
"""

from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c7a94e21f630"
down_revision: Union[str, None] = "b1f73d9c4a26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LIVE_STATUSES = ("prepared", "starting", "active", "stopping")


def upgrade() -> None:
    with op.batch_alter_table("voice_sessions") as batch_op:
        batch_op.add_column(sa.Column("provider_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("provider_stopped_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("completion_request", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("completion_result", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("action_lease_token", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("action_lease_until", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("last_provider_error_code", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("last_provider_request_id", sa.String(length=120), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text(
        "SELECT id, user_id FROM voice_sessions "
        "WHERE status IN ('prepared', 'starting', 'active', 'stopping') "
        "ORDER BY user_id, created_at DESC, id DESC"
    )).mappings()
    retained_users: set[str] = set()
    expired_at = datetime.now(timezone.utc)
    for row in rows:
        if row["user_id"] in retained_users:
            connection.execute(
                sa.text(
                    "UPDATE voice_sessions SET status = 'expired', completed_at = :completed_at "
                    "WHERE id = :session_id"
                ),
                {"completed_at": expired_at, "session_id": row["id"]},
            )
        else:
            retained_users.add(row["user_id"])

    live_predicate = sa.text("status IN ('prepared', 'starting', 'active', 'stopping')")
    op.create_index(
        "uq_voice_sessions_live_user",
        "voice_sessions",
        ["user_id"],
        unique=True,
        sqlite_where=live_predicate,
        postgresql_where=live_predicate,
    )


def downgrade() -> None:
    op.drop_index("uq_voice_sessions_live_user", table_name="voice_sessions")
    with op.batch_alter_table("voice_sessions") as batch_op:
        batch_op.drop_column("last_provider_request_id")
        batch_op.drop_column("last_provider_error_code")
        batch_op.drop_column("action_lease_until")
        batch_op.drop_column("action_lease_token")
        batch_op.drop_column("completion_result")
        batch_op.drop_column("completion_request")
        batch_op.drop_column("provider_stopped_at")
        batch_op.drop_column("provider_started_at")
