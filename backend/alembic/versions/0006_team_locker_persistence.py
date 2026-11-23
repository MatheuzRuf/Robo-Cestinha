"""Persist team seasons and unique session team claims.

Revision ID: 0006_team_locker_persistence
Revises: 0005_nba_media_ids
Create Date: 2026-11-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_team_locker_persistence"
down_revision: str | Sequence[str] | None = "0005_nba_media_ids"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("season", sa.String(), nullable=True))
    op.execute("UPDATE teams SET season = '2025-26' WHERE season IS NULL")
    op.alter_column("teams", "season", nullable=False)
    op.create_unique_constraint(
        "uq_users_session_team", "users", ["session_id", "team_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_session_team", "users", type_="unique")
    op.drop_column("teams", "season")
