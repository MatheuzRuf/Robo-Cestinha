from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.domain.bracket.repository import BracketRepository
from app.domain.bracket.service import BracketService
from app.domain.sessions.repository import SessionRepository
from app.domain.sessions.service import SessionService


class ServiceFactory:
    """Build request-scoped application services."""

    def __init__(self, db: AsyncSession = Depends(get_db)) -> None:
        """Initialize the factory with a request-scoped database session.

        Args:
            db: Active async database session.
        """

        self._db = db

    def bracket_service(self) -> BracketService:
        """Build a bracket service for the current request.

        Returns:
            A bracket service backed by the current database session.
        """

        return BracketService(
            repository=BracketRepository(self._db),
        )

    def session_service(self) -> SessionService:
        """Build a session service for the current request.

        Returns:
            A session service backed by the current database session.
        """

        return SessionService(
            repository=SessionRepository(self._db),
            bracket_service=self.bracket_service(),
        )
