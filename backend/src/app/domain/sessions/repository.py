import uuid

from app.db.models import (
    Match,
    MatchEvent,
    MatchFrameChunk,
    MatchSimulation,
    Session,
    User,
)
from app.domain.base_repository import BaseRepository
from sqlalchemy import delete, func, select, update


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

    async def list_users(self, session_id: uuid.UUID) -> list[User]:
        """Return session participants in join order.

        Args:
            session_id: Session whose participants should be listed.

        Returns:
            Participants ordered by their assigned join sequence.
        """

        result = await self._db.execute(
            select(User)
            .where(User.session_id == session_id)
            .order_by(User.join_sequence)
        )
        return list(result.scalars().all())

    async def get_user(
        self, session_id: uuid.UUID, user_id: uuid.UUID, *, for_update: bool = False
    ) -> User | None:
        """Find a participant within the requested session.

        Args:
            session_id: Session that must contain the participant.
            user_id: Participant identifier.
            for_update: Lock the matching row for a transaction.

        Returns:
            The matching participant, if present in the session.
        """

        statement = select(User).where(
            User.session_id == session_id,
            User.id == user_id,
        )
        if for_update:
            statement = statement.with_for_update().execution_options(
                populate_existing=True
            )
        result = await self._db.execute(statement)
        return result.scalar_one_or_none()

    async def delete_participant(self, user: User) -> None:
        """Delete one participant and release their team claim.

        Args:
            user: Participant row to delete.
        """

        await self._db.delete(user)
        await self.flush()

    async def delete_session_records(self, session_id: uuid.UUID) -> None:
        """Delete a session's matches, simulations, participants, and session row.

        Args:
            session_id: Session whose tournament data should be removed.
        """

        match_ids = select(Match.id).where(Match.session_id == session_id)
        simulation_ids = select(MatchSimulation.id).where(
            MatchSimulation.match_id.in_(match_ids)
        )

        await self._db.execute(
            delete(MatchEvent).where(MatchEvent.simulation_id.in_(simulation_ids))
        )
        await self._db.execute(
            delete(MatchFrameChunk).where(
                MatchFrameChunk.simulation_id.in_(simulation_ids)
            )
        )
        await self._db.execute(
            delete(MatchSimulation).where(MatchSimulation.match_id.in_(match_ids))
        )
        await self._db.execute(
            update(Match)
            .where(Match.session_id == session_id)
            .values(next_match_id=None)
        )
        await self._db.execute(delete(Match).where(Match.session_id == session_id))
        await self._db.execute(
            update(Session).where(Session.id == session_id).values(owner_id=None)
        )
        await self._db.execute(delete(User).where(User.session_id == session_id))
        await self._db.execute(delete(Session).where(Session.id == session_id))

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
