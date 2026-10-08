"""Ensure participant join sequences are unique within each session.

Revision ID: 0002_session_join_seq
Revises: 0001_initial_tables
Create Date: 2026-10-07 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_session_join_seq"
down_revision: str | Sequence[str] | None = "0001_initial_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_users_session_join_sequence", "users", ["session_id", "join_sequence"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_session_join_sequence", "users", type_="unique")
