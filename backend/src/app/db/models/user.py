import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.session import Session
    from app.db.models.team import Team


class User(Base):
    """A participant registered in a session."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint(
            "session_id", "join_sequence", name="uq_users_session_join_sequence"
        ),
        UniqueConstraint("session_id", "team_id", name="uq_users_session_team"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    join_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )

    session: Mapped["Session"] = relationship(
        back_populates="users", foreign_keys=[session_id]
    )
    team: Mapped["Team | None"] = relationship()
