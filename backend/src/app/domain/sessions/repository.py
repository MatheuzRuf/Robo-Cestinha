import uuid

from app.db.models import Session, User
from app.domain.base_repository import BaseRepository
from sqlalchemy import func, select


class SessionRepository(BaseRepository):
    """Persist session and user entities."""

    async def get_session_by_hash(
        self, session_hash: str, *, for_update: bool = False
    ) -> Session | None:
        """Find a session by its public code, accepting an optional leading hash.

        Args:
            session_hash: Public session code to look up.
            for_update: Lock the matching row for a transaction.

        Returns:
            The matching session, if it exists.
        """

        normalized_hash = session_hash.strip().upper().removeprefix("#")
        statement = select(Session).where(
            func.upper(Session.hash).in_((normalized_hash, f"#{normalized_hash}"))
        )
        if for_update:
            statement = statement.with_for_update()

        result = await self._db.execute(statement)
        return result.scalar_one_or_none()

    async def next_join_sequence(self, session_id: uuid.UUID) -> int:
        """Return the next participant sequence within a session.

        Args:
            session_id: Session whose existing participants should be counted.

        Returns:
            The next one-based join sequence.
        """

        result = await self._db.execute(
            select(func.max(User.join_sequence)).where(User.session_id == session_id)
        )
        return (result.scalar_one() or 0) + 1

    async def add_session(self, session: Session) -> None:
        """Add a session and flush it to the current transaction.

        Args:
            session: Session entity to persist.
        """

        await self.add(session)
        await self.flush()

    async def add_user(self, user: User) -> None:
        """Add a user and flush it to the current transaction.

        Args:
            user: User entity to persist.
        """

        await self.add(user)
        await self.flush()
