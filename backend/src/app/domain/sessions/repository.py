from app.db.models import Session, User
from app.domain.base_repository import BaseRepository


class SessionRepository(BaseRepository):
    """Persist session and user entities."""

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
