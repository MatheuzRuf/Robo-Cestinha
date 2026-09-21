import uuid

from sqlalchemy import select

from app.db.models import Match, Team
from app.domain.base_repository import BaseRepository


class BracketRepository(BaseRepository):
    """Persist bracket matches and read catalog teams."""

    async def list_team_ids(self) -> list[uuid.UUID]:
        """Return the IDs of all teams in the catalog.

        Returns:
            Catalog team IDs.
        """

        result = await self._db.execute(select(Team.id))
        return list(result.scalars().all())

    async def add_matches(self, matches: list[Match]) -> None:
        """Add bracket matches to the current transaction.

        Args:
            matches: Match entities to persist.
        """

        await self.add_all(matches)
