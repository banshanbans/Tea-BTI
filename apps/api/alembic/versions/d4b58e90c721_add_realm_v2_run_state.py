"""add Realm V2 run state and deterministic outcome

Revision ID: d4b58e90c721
Revises: c7a94e21f630
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4b58e90c721"
down_revision: Union[str, None] = "c7a94e21f630"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("realm_progress", sa.Column("run_state", sa.JSON(), nullable=True))
    op.add_column("realm_progress", sa.Column("latest_outcome", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("realm_progress", "latest_outcome")
    op.drop_column("realm_progress", "run_state")
