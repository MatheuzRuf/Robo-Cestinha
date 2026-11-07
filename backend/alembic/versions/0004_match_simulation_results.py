"""Add match simulation, event, and frame-chunk tables.

Revision ID: 0004_match_simulation_results
Revises: 0003_team_player_catalog_fields
Create Date: 2026-10-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_match_simulation_results"
down_revision: str | Sequence[str] | None = "0003_team_player_catalog_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "match_simulations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("matches.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("iterations_limit", sa.Integer(), nullable=False),
        sa.Column("iterations_completed", sa.Integer(), nullable=False),
        sa.Column("overtime_iterations", sa.Integer(), nullable=False),
        sa.Column("termination_reason", sa.String(), nullable=True),
        sa.Column("random_seed", sa.Integer(), nullable=True),
        sa.Column("engine_version", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_match_simulations_match_id", "match_simulations", ["match_id"]
    )

    op.create_table(
        "match_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "simulation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("match_simulations.id"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("iteration", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "target_player_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_unique_constraint(
        "uq_match_event_sequence", "match_events", ["simulation_id", "sequence"]
    )

    op.create_table(
        "match_frame_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "simulation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("match_simulations.id"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("first_iteration", sa.Integer(), nullable=False),
        sa.Column("frame_count", sa.Integer(), nullable=False),
        sa.Column("frames", sa.JSON(), nullable=False),
    )
    op.create_unique_constraint(
        "uq_match_frame_chunk_index",
        "match_frame_chunks",
        ["simulation_id", "chunk_index"],
    )


def downgrade() -> None:
    op.drop_table("match_frame_chunks")
    op.drop_table("match_events")
    op.drop_table("match_simulations")