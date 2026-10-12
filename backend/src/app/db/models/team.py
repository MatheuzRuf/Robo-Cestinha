import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.player import Player


class Team(Base):
    """A catalog team that can be assigned to a bracket."""

    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    catalog_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    abbreviation: Mapped[str | None] = mapped_column(String, nullable=True)
    team_stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    players: Mapped[list["Player"]] = relationship(back_populates="team")
