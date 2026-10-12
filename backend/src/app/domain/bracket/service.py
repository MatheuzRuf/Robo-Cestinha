import math
import random
import uuid

from app.db.models import Match
from app.domain.bracket.repository import BracketRepository
from app.domain.sessions.service import SessionService


class BracketOwnerRequiredError(PermissionError):
    """Raised when a non-owner attempts to generate a bracket."""


class BracketAlreadyGeneratedError(RuntimeError):
    """Raised when a bracket already exists for a session."""


class BracketService:
    """Apply bracket rules and coordinate bracket persistence."""

    def __init__(
        self, repository: BracketRepository, session_service: SessionService
    ) -> None:
        """Initialize the service with its collaborators.

        Args:
            repository: Repository used to read teams and persist matches.
            session_service: Service used to look up session details.
        """

        self._repository = repository
        self._session_service = session_service

    async def get_bracket(
        self, session_hash: str, user_id: uuid.UUID
    ) -> dict[str, object]:
        """Return a saved bracket or an empty bracket skeleton.

        Args:
            session_hash: Public session code that owns the bracket.
            user_id: Current participant used to determine whether they can generate.

        Returns:
            Bracket data and whether the participant can generate it.

        Raises:
            SessionNotFoundError: If no matching session exists.
        """

        session = await self._session_service.get_session(session_hash)

        match_rows = await self._repository.list_matches(session.id)
        generated = bool(match_rows)
        matches_by_round: dict[int, list[dict[str, object]]] = {
            round_number: [] for round_number in range(3)
        }

        if generated:
            for match, home_name, away_name in match_rows:
                matches_by_round[match.round].append(
                    {
                        "match_id": match.id,
                        "slot": match.slot_in_round,
                        "home_team": self._team_payload(match.home_team_id, home_name),
                        "away_team": self._team_payload(match.away_team_id, away_name),
                    }
                )
        else:
            for round_number, match_count in enumerate((4, 2, 1)):
                matches_by_round[round_number] = [
                    {
                        "match_id": None,
                        "slot": slot,
                        "home_team": None,
                        "away_team": None,
                    }
                    for slot in range(match_count)
                ]

        return {
            "generated": generated,
            "can_generate": not generated and session.owner_id == user_id,
            "rounds": [
                {
                    "round_number": round_number,
                    "matches": matches_by_round[round_number],
                }
                for round_number in range(3)
            ],
        }

    async def generate_bracket(
        self, session_hash: str, user_id: uuid.UUID, num_teams: int = 8
    ) -> dict[str, object]:
        """Generate and persist a random bracket for its session owner.

        Args:
            session_hash: Public session code that owns the bracket.
            user_id: Participant requesting bracket generation.
            num_teams: Number of catalog teams to place in the bracket.

        Returns:
            The newly generated bracket.

        Raises:
            BracketAlreadyGeneratedError: If a bracket already exists.
            BracketOwnerRequiredError: If the requester is not the session owner.
            SessionNotFoundError: If no matching session exists.
            ValueError: If the catalog does not contain enough teams.
        """

        session = await self._session_service.get_session(session_hash)
        if session.owner_id != user_id:
            raise BracketOwnerRequiredError(session_hash)
        if await self._repository.list_matches(session.id):
            raise BracketAlreadyGeneratedError(session_hash)

        await self.seed_bracket_for_session(session.id, num_teams)
        await self._repository.commit()
        return await self.get_bracket(session_hash, user_id)

    def _team_payload(
        self, team_id: uuid.UUID | None, team_name: str | None
    ) -> dict[str, object] | None:
        """Build a response payload for an assigned team.

        Args:
            team_id: Assigned team identifier.
            team_name: Assigned team name.

        Returns:
            Team details, or None when the slot is empty.
        """

        if team_id is None or team_name is None:
            return None
        return {"id": team_id, "name": team_name}

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
