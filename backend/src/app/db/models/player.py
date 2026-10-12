import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.team import Team


class Player(Base):
    """A player belonging to a catalog team."""

    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    catalog_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    position: Mapped[str | None] = mapped_column(String, nullable=True)
    position5: Mapped[str | None] = mapped_column(String, nullable=True)
    is_starter: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    team: Mapped["Team"] = relationship(back_populates="players")
