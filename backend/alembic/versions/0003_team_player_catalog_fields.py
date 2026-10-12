"""Add processed catalog fields to teams and players.

Revision ID: 0003_team_player_catalog_fields
Revises: 0002_session_join_seq
Create Date: 2026-10-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_team_player_catalog_fields"
down_revision: str | Sequence[str] | None = "0002_session_join_seq"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("catalog_id", sa.String(), nullable=True))
    op.add_column("teams", sa.Column("abbreviation", sa.String(), nullable=True))
    op.add_column("teams", sa.Column("team_stats", sa.JSON(), nullable=True))
    op.create_unique_constraint("uq_teams_catalog_id", "teams", ["catalog_id"])

    op.add_column("players", sa.Column("catalog_id", sa.String(), nullable=True))
    op.add_column("players", sa.Column("position", sa.String(), nullable=True))
    op.add_column("players", sa.Column("position5", sa.String(), nullable=True))
    op.add_column("players", sa.Column("is_starter", sa.Boolean(), nullable=True))
    op.create_unique_constraint("uq_players_catalog_id", "players", ["catalog_id"])


def downgrade() -> None:
    op.drop_constraint("uq_players_catalog_id", "players", type_="unique")
    op.drop_column("players", "is_starter")
    op.drop_column("players", "position5")
    op.drop_column("players", "position")
    op.drop_column("players", "catalog_id")

    op.drop_constraint("uq_teams_catalog_id", "teams", type_="unique")
    op.drop_column("teams", "team_stats")
    op.drop_column("teams", "abbreviation")
    op.drop_column("teams", "catalog_id")
