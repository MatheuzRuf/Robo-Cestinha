import uuid

from app.core.ids import generate_session_hash
from app.db.models import Session, User
from app.domain.sessions.repository import SessionRepository
from app.domain.sessions.types import SessionParticipant


class SessionNotFoundError(LookupError):
    """Raised when a requested session does not exist."""


class SessionParticipantNotFoundError(LookupError):
    """Raised when a user is not a participant in the requested session."""


class SessionOwnerRequiredError(PermissionError):
    """Raised when a non-owner attempts to delete a session."""


class SessionOwnerCannotLeaveError(PermissionError):
    """Raised when the session owner attempts to leave without deleting it."""


class SessionService:
    """Coordinate session creation, lookup, and membership."""

    def __init__(self, repository: SessionRepository) -> None:
        """Initialize the service with its repository.

        Args:
            repository: Repository used to persist sessions and users.
        """

        self._repository = repository

    async def create_session(
        self,
        owner_name: str,
        session_name: str = "Tournament",
        *,
        commit: bool = True,
    ) -> tuple[Session, User]:
        """Create a session and its owner.

        Args:
            owner_name: Display name for the session owner.
            session_name: Display name for the tournament session.
            commit: Whether to commit the session before returning.

        Returns:
            The created session and owner user.
        """

        session = Session(
            id=uuid.uuid4(),
            hash=generate_session_hash(),
            name=session_name,
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

        if commit:
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

    async def leave_session(self, session_hash: str, user_id: uuid.UUID) -> None:
        """Remove a non-owner participant from a session.

        Args:
            session_hash: Public session code to leave.
            user_id: Participant leaving the session.

        Raises:
            SessionNotFoundError: If no session matches the public code.
            SessionParticipantNotFoundError: If the user is not a participant.
            SessionOwnerCannotLeaveError: If the user owns the session.
        """

        session = await self._repository.get_session_by_hash(
            session_hash, for_update=True
        )
        if session is None:
            raise SessionNotFoundError(session_hash)
        user = await self._repository.get_user(session.id, user_id, for_update=True)
        if user is None:
            raise SessionParticipantNotFoundError(user_id)
        if user.id == session.owner_id:
            raise SessionOwnerCannotLeaveError(user_id)
        await self._repository.delete_participant(user)
        await self._repository.commit()

    async def delete_session(self, session_hash: str, user_id: uuid.UUID) -> None:
        """Delete a session and all its tournament-specific persisted data.

        Args:
            session_hash: Public session code to delete.
            user_id: User requesting deletion.

        Raises:
            SessionNotFoundError: If no session matches the public code.
            SessionOwnerRequiredError: If the requester does not own the session.
        """

        session = await self._repository.get_session_by_hash(
            session_hash, for_update=True
        )
        if session is None:
            raise SessionNotFoundError(session_hash)
        if session.owner_id != user_id:
            raise SessionOwnerRequiredError(user_id)
        await self._repository.delete_session_records(session.id)
        await self._repository.commit()

    async def list_participants(self, session_hash: str) -> list[SessionParticipant]:
        """List persisted participants in their join order.

        Args:
            session_hash: Public session code to list participants for.

        Returns:
            Session participants with ownership identified.

        Raises:
            SessionNotFoundError: If no session matches the public code.
        """

        session = await self.get_session(session_hash)
        users = await self._repository.list_users(session.id)
        return [
            SessionParticipant(
                user_id=user.id,
                user_name=user.name,
                join_sequence=user.join_sequence,
                is_owner=user.id == session.owner_id,
            )
            for user in users
        ]
