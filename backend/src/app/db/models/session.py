import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Session(Base):
    """A tournament session that owns users and bracket matches."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="session", foreign_keys="User.session_id"
    )
    matches: Mapped[list["Match"]] = relationship(back_populates="session")
