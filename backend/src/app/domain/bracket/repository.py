import uuid

from app.db.models import Match, Team
from app.domain.base_repository import BaseRepository
from sqlalchemy import select
from sqlalchemy.orm import aliased


class BracketRepository(BaseRepository):
    """Persist bracket matches and read catalog teams."""

    async def list_team_ids(self) -> list[uuid.UUID]:
        """Return the IDs of all teams in the catalog.

        Returns:
            Catalog team IDs.
        """

        result = await self._db.execute(select(Team.id))
        return list(result.scalars().all())

    async def list_matches(
        self, session_id: uuid.UUID
    ) -> list[tuple[Match, str | None, str | None]]:
        """Return matches and their assigned team names in bracket order.

        Args:
            session_id: Session that owns the bracket.

        Returns:
            Match rows with optional home and away team names.
        """

        home_team = aliased(Team)
        away_team = aliased(Team)
        statement = (
            select(Match, home_team.name, away_team.name)
            .outerjoin(home_team, Match.home_team_id == home_team.id)
            .outerjoin(away_team, Match.away_team_id == away_team.id)
            .where(Match.session_id == session_id)
            .order_by(Match.round, Match.slot_in_round)
        )
        result = await self._db.execute(statement)
        return list(result.all())

    async def add_matches(self, matches: list[Match]) -> None:
        """Persist bracket matches after their next-round targets exist.

        Args:
            matches: Match entities to persist.
        """

        for round_number in sorted({match.round for match in matches}, reverse=True):
            round_matches = [match for match in matches if match.round == round_number]
            await self.add_all(round_matches)
            await self.flush()
