import math
import random
import uuid

from app.db.models import Match
from app.domain.bracket.repository import BracketRepository


class BracketService:
    """Apply bracket rules and coordinate bracket persistence."""

    def __init__(self, repository: BracketRepository) -> None:
        """Initialize the service with a bracket repository.

        Args:
            repository: Repository used to read teams and persist matches.
        """

        self._repository = repository

    async def seed_bracket_for_session(
        self,
        session_id: uuid.UUID,
        num_teams: int,
    ) -> None:
        """Create and persist a seeded elimination bracket.

        Args:
            session_id: Session that owns the bracket matches.
            num_teams: Number of catalog teams to place in the bracket.

        Raises:
            ValueError: If the catalog does not contain enough teams.
        """

        all_team_ids = await self._repository.list_team_ids()
        if len(all_team_ids) < num_teams:
            raise ValueError(
                f"Not enough teams in catalog ({len(all_team_ids)}) "
                f"to seed a {num_teams}-team bracket. "
                f"Run the seed script first."
            )

        selected_team_ids = random.sample(all_team_ids, num_teams)
        await self._repository.add_matches(
            self._build_matches(session_id, selected_team_ids)
        )

    def _build_matches(
        self,
        session_id: uuid.UUID,
        team_ids: list[uuid.UUID],
    ) -> list[Match]:
        """Build all matches and their progression links.

        Args:
            session_id: Session that owns the bracket matches.
            team_ids: Ordered team IDs for the first round.

        Returns:
            Matches for every round of the bracket.
        """

        num_teams = len(team_ids)
        num_rounds = int(math.log2(num_teams))

        rounds: list[list[Match]] = []
        matches_in_round = num_teams // 2
        for round_index in range(num_rounds):
            round_matches = [
                Match(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    round=round_index,
                    slot_in_round=slot,
                    status="locked",
                )
                for slot in range(matches_in_round)
            ]
            rounds.append(round_matches)
            matches_in_round //= 2

        for round_index in range(num_rounds - 1):
            for match in rounds[round_index]:
                next_match = rounds[round_index + 1][match.slot_in_round // 2]
                match.next_match_id = next_match.id
                match.next_match_slot = (
                    "home" if match.slot_in_round % 2 == 0 else "away"
                )

        remaining_team_ids = list(team_ids)
        for match in rounds[0]:
            match.home_team_id = remaining_team_ids.pop(0)
            match.away_team_id = remaining_team_ids.pop(0)
            match.status = "ready"

        return [match for round_matches in rounds for match in round_matches]
