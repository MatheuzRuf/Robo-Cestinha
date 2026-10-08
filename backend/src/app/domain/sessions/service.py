import uuid

from app.core.ids import generate_session_hash
from app.db.models import Session, User
from app.domain.bracket.service import BracketService
from app.domain.sessions.repository import SessionRepository


class SessionNotFoundError(LookupError):
    """Raised when a requested session does not exist."""


class SessionService:
    """Coordinate session creation and its initial bracket."""

    def __init__(
        self,
        repository: SessionRepository,
        bracket_service: BracketService,
    ) -> None:
        """Initialize the service with its collaborators.

        Args:
            repository: Repository used to persist sessions and users.
            bracket_service: Service used to create the initial bracket.
        """

        self._repository = repository
        self._bracket_service = bracket_service

    async def create_session(
        self,
        owner_name: str,
        num_teams: int = 8,
    ) -> tuple[Session, User]:
        """Create a session, its owner, and a seeded bracket.

        Args:
            owner_name: Display name for the session owner.
            num_teams: Number of catalog teams to seed into the bracket.

        Returns:
            The created session and owner user.

        Raises:
            ValueError: If the catalog does not contain enough teams.
        """

        session = Session(
            id=uuid.uuid4(),
            hash=generate_session_hash(),
        )
        await self._repository.add_session(session)

        owner = User(
            id=uuid.uuid4(),
            session_id=session.id,
            join_sequence=1,
            name=owner_name,
        )
        await self._repository.add_user(owner)
        session.owner_id = owner.id

        await self._repository.commit()
        await self._repository.refresh(session)

        return session, owner

    async def get_session(self, session_hash: str) -> Session:
        """Look up a session by its public code.

        Args:
            session_hash: Public session code to find.

        Returns:
            The matching persisted session.

        Raises:
            SessionNotFoundError: If no session matches the public code.
        """

        session = await self._repository.get_session_by_hash(session_hash)
        if session is None:
            raise SessionNotFoundError(session_hash)
        return session

    async def join_session(
        self, session_hash: str, user_name: str
    ) -> tuple[Session, User]:
        """Add a participant and assign the next sequence in a session.

        Args:
            session_hash: Public session code to join.
            user_name: Participant display name.

        Returns:
            The session and newly created participant.

        Raises:
            SessionNotFoundError: If no session matches the public code.
        """

        session = await self._repository.get_session_by_hash(
            session_hash, for_update=True
        )
        if session is None:
            raise SessionNotFoundError(session_hash)

        user = User(
            id=uuid.uuid4(),
            session_id=session.id,
            join_sequence=await self._repository.next_join_sequence(session.id),
            name=user_name,
        )
        await self._repository.add_user(user)
        await self._repository.commit()
        return session, user
