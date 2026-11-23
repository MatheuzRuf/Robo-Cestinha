"""Persist display names for tournament sessions.

Revision ID: 0007_session_names
Revises: 0006_team_locker_persistence
Create Date: 2026-11-23 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_session_names"
down_revision: str | Sequence[str] | None = "0006_team_locker_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("name", sa.String(), nullable=True))
    op.execute("UPDATE sessions SET name = 'Tournament' WHERE name IS NULL")
    op.alter_column("sessions", "name", nullable=False)


def downgrade() -> None:
    op.drop_column("sessions", "name")
