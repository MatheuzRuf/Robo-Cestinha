from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_db
from app.domain.bracket.repository import BracketRepository
from app.domain.bracket.service import BracketService
from app.domain.matches.engine_adapter import MatchEngineAdapter
from app.domain.matches.repository import MatchRepository
from app.domain.matches.service import MatchService
from app.domain.sessions.repository import SessionRepository
from app.domain.sessions.service import SessionService


class ServiceFactory:
    """Build request-scoped application services."""

    def __init__(self, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
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
            session_service=self.session_service(),
        )

    def session_service(self) -> SessionService:
        """Build a session service for the current request.

        Returns:
            A session service backed by the current database session.
        """

        return SessionService(
            repository=SessionRepository(self._db),
        )

    def match_service(self) -> MatchService:
        """Build a match service for the current request.

        Returns:
            A match service backed by the current database session.
        """

        return MatchService(
            repository=MatchRepository(self._db),
            engine_adapter=MatchEngineAdapter(),
            max_iterations=settings.max_simulation_iterations,
        )
