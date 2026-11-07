import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MatchSimulation(Base):
    """A single, unique simulation run for a bracket match."""

    __tablename__ = "match_simulations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id"),
        nullable=False,
        unique=True,
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")
    iterations_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    iterations_completed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    overtime_iterations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    termination_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    random_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engine_version: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    match: Mapped["Match"] = relationship(back_populates="simulation")
    events: Mapped[list["MatchEvent"]] = relationship(
        back_populates="simulation", cascade="all, delete-orphan"
    )
    frame_chunks: Mapped[list["MatchFrameChunk"]] = relationship(
        back_populates="simulation", cascade="all, delete-orphan"
    )
