"""Persist NBA IDs used to build team and player image URLs.

Revision ID: 0005_nba_media_ids
Revises: 0004_match_simulation_results
Create Date: 2026-11-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_nba_media_ids"
down_revision: str | Sequence[str] | None = "0004_match_simulation_results"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("nba_team_id", sa.Integer(), nullable=True))
    op.add_column("players", sa.Column("nba_player_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "nba_player_id")
    op.drop_column("teams", "nba_team_id")
