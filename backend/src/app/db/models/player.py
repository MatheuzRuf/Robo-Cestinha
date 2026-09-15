import uuid

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    team: Mapped["Team"] = relationship(back_populates="players")
