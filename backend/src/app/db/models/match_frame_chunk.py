import uuid

from sqlalchemy import JSON, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MatchFrameChunk(Base):
    """A batch of ordered simulation frames for one match."""

    __tablename__ = "match_frame_chunks"
    __table_args__ = (
        UniqueConstraint(
            "simulation_id", "chunk_index", name="uq_match_frame_chunk_index"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    simulation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("match_simulations.id"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    first_iteration: Mapped[int] = mapped_column(Integer, nullable=False)
    frame_count: Mapped[int] = mapped_column(Integer, nullable=False)
    frames: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)

    simulation: Mapped["MatchSimulation"] = relationship(back_populates="frame_chunks")
