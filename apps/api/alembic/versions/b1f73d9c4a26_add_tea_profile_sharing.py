"""add tea profile and revocable sharing

Revision ID: b1f73d9c4a26
Revises: 8e2c7f29a8d1
Create Date: 2026-08-28 18:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b1f73d9c4a26"
down_revision: Union[str, None] = "8e2c7f29a8d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tea_profiles",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=24), nullable=False),
        sa.Column("bio", sa.String(length=80), nullable=False),
        sa.Column("selected_tea_id", sa.String(length=80), nullable=True),
        sa.Column("source_feedback_id", sa.String(length=36), nullable=True),
        sa.Column("public_quote", sa.String(length=120), nullable=True),
        sa.Column("public_block_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_feedback_id"], ["drink_feedback.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["anonymous_users.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "profile_shares",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("public_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["anonymous_users.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(op.f("ix_profile_shares_public_id"), "profile_shares", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_profile_shares_public_id"), table_name="profile_shares")
    op.drop_table("profile_shares")
    op.drop_table("tea_profiles")
