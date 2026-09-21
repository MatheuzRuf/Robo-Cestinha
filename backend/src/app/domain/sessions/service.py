import uuid

from app.core.ids import generate_session_hash
from app.db.models import Session, User
from app.domain.bracket.service import BracketService
from app.domain.sessions.repository import SessionRepository


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

        await self._bracket_service.seed_bracket_for_session(
            session_id=session.id,
            num_teams=num_teams,
        )

        await self._repository.commit()
        await self._repository.refresh(session)

        return session, owner
