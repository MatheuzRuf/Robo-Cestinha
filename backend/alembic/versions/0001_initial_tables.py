"""initial tables

Revision ID: 0001_initial_tables
Revises: 
Create Date: 2026-09-14 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0001_initial_tables"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_table(
        "players",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("attributes", sa.JSON(), nullable=False),
    )
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("hash", sa.String(), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(op.f("ix_sessions_hash"), "sessions", ["hash"], unique=True)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("join_sequence", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
    )
    op.create_foreign_key(None, "sessions", "users", ["owner_id"], ["id"])
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("slot_in_round", sa.Integer(), nullable=False),
        sa.Column("home_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("away_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("next_match_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("matches.id"), nullable=True),
        sa.Column("next_match_slot", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="locked"),
        sa.Column("home_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("away_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("winner_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("matches")
    op.drop_index(op.f("ix_sessions_hash"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("players")
    op.drop_table("teams")
