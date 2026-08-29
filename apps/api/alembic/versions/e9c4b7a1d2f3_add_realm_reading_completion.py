"""add Realm reading completion channels

Revision ID: e9c4b7a1d2f3
Revises: e5c91a32b804
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e9c4b7a1d2f3"
down_revision: Union[str, None] = "e5c91a32b804"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("realm_progress", sa.Column("first_completion_mode", sa.String(length=16), nullable=True))
    op.add_column("realm_progress", sa.Column("reading_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("realm_progress", sa.Column("interactive_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE realm_progress SET first_completion_mode = 'interactive', "
        "interactive_completed_at = completed_at WHERE completed_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("realm_progress", "interactive_completed_at")
    op.drop_column("realm_progress", "reading_completed_at")
    op.drop_column("realm_progress", "first_completion_mode")
