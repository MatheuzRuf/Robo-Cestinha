from app.db.models import Session, User
from app.domain.bracket.service import BracketService
from app.domain.sessions.service import SessionService


class SessionSetupService:
    """Create a session and its initial bracket as one workflow."""

    def __init__(
        self, session_service: SessionService, bracket_service: BracketService
    ) -> None:
        """Initialize the setup workflow with session and bracket services.

        Args:
            session_service: Service used to create the session and owner.
            bracket_service: Service used to create the initial match tree.
        """

        self._session_service = session_service
        self._bracket_service = bracket_service

    async def create_session(
        self, owner_name: str, session_name: str = "Tournament"
    ) -> tuple[Session, User]:
        """Create a session, owner, and bracket in the current transaction.

        Args:
            owner_name: Display name for the session owner.
            session_name: Display name for the tournament session.

        Returns:
            The created session and owner participant.
        """

        session, owner = await self._session_service.create_session(
            owner_name, session_name, commit=False
        )
        await self._bracket_service.generate_bracket(session.hash, owner.id)
        return session, owner
