import uuid

from app.db.models import Team
from app.domain.sessions.service import SessionService
from app.domain.teams.errors import (
    AlreadyClaimedError,
    BracketNotGeneratedError,
    ParticipantNotFoundError,
    TeamClaimConflictError,
    TeamNotFoundError,
    TeamUnavailableError,
)
from app.domain.teams.repository import TeamRepository
from app.domain.teams.types import (
    LockerPlayer,
    LockerTeam,
    TeamLockerContext,
    TeamLockerSnapshot,
)


class TeamLockerService:
    """Apply session team selection rules and build locker snapshots."""

    def __init__(
        self, repository: TeamRepository, session_service: SessionService
    ) -> None:
        """Initialize the service with persistence and session collaborators.

        Args:
            repository: Repository used to load and claim teams.
            session_service: Service used to resolve public session codes.
        """

        self._repository = repository
        self._session_service = session_service

    async def get_locker(
        self, session_hash: str, user_id: uuid.UUID
    ) -> TeamLockerSnapshot:
        """Return the session's persisted team locker.

        Args:
            session_hash: Public session code whose locker is requested.
            user_id: Participant viewing the locker.

        Returns:
            Persisted teams, roster data, claims, and counts.

        Raises:
            SessionNotFoundError: If no session matches the public code.
            ParticipantNotFoundError: If the participant is not in the session.
            BracketNotGeneratedError: If the session has no generated bracket.
        """

        session = await self._session_service.get_session(session_hash)
        context = await self._repository.get_locker_context(session.id, user_id)
        return self._snapshot(session.hash, user_id, context)

    async def claim_team(
        self,
        session_hash: str,
        user_id: uuid.UUID,
        team_id: uuid.UUID,
    ) -> TeamLockerSnapshot:
        """Persist a participant's team selection and return the refreshed locker.

        Args:
            session_hash: Public session code containing the locker.
            user_id: Participant claiming a team.
            team_id: Team to assign to the participant.

        Returns:
            The refreshed team locker after the claim.

        Raises:
            SessionNotFoundError: If no session matches the public code.
            ParticipantNotFoundError: If the participant is not in the session.
            BracketNotGeneratedError: If the session has no generated bracket.
            AlreadyClaimedError: If the participant already selected a team.
            TeamNotFoundError: If the team is not part of this bracket.
            TeamUnavailableError: If another participant claimed or eliminated it.
        """

        session = await self._session_service.get_session(session_hash)
        context = await self._repository.get_locker_context(session.id, user_id)
        if context.participant is None:
            raise ParticipantNotFoundError(user_id)
        self._validate_context(context)
        if context.participant.team_id is not None:
            raise AlreadyClaimedError(user_id)

        team = next((team for team in context.teams if team.id == team_id), None)
        if team is None:
            raise TeamNotFoundError(team_id)
        if team_id in context.team_claims or team_id in context.eliminated_team_ids:
            raise TeamUnavailableError(team_id)

        try:
            await self._repository.claim_team(session.id, user_id, team_id)
        except TeamClaimConflictError as error:
            raise TeamUnavailableError(team_id) from error

        refreshed_context = await self._repository.get_locker_context(
            session.id, user_id
        )
        return self._snapshot(session.hash, user_id, refreshed_context)

    def _snapshot(
        self,
        session_hash: str,
        user_id: uuid.UUID,
        context: TeamLockerContext,
    ) -> TeamLockerSnapshot:
        """Validate locker access and map persistence rows to domain output.

        Args:
            session_hash: Canonical public session code.
            user_id: Participant viewing the locker.
            context: Persisted roster, bracket, and claim state.

        Returns:
            A domain snapshot ready for API serialization.
        """

        if context.participant is None:
            raise ParticipantNotFoundError(user_id)
        self._validate_context(context)

        my_team_id = context.participant.team_id
        teams = [self._team_snapshot(team, user_id, context) for team in context.teams]
        return TeamLockerSnapshot(
            session_hash=session_hash,
            teams=teams,
            my_team_id=my_team_id,
            open_team_count=sum(team.claim_status == "available" for team in teams),
            total_team_count=len(teams),
        )

    def _validate_context(self, context: TeamLockerContext) -> None:
        """Reject team locker requests before the session bracket exists.

        Args:
            context: Persisted bracket state for the session.

        Raises:
            BracketNotGeneratedError: If no first-round matches exist.
        """

        if not context.bracket_generated:
            raise BracketNotGeneratedError

    def _team_snapshot(
        self,
        team: Team,
        user_id: uuid.UUID,
        context: TeamLockerContext,
    ) -> LockerTeam:
        """Map a persisted team and its players to the locker domain shape.

        Args:
            team: Persisted catalog team assigned to the session bracket.
            user_id: Participant viewing the locker.
            context: Persisted claim and roster data.

        Returns:
            The team with its current session-scoped availability.
        """

        owner_id = context.team_claims.get(team.id)
        claim_status = (
            "locked_by_you"
            if owner_id == user_id
            else "locked_by_other"
            if owner_id is not None or team.id in context.eliminated_team_ids
            else "available"
        )
        players = [
            LockerPlayer(
                id=player.id,
                nba_player_id=player.nba_player_id,
                name=player.name,
                position=player.position5 or player.position or "X",
                position_group=player.position or "X",
                is_starter=bool(player.is_starter),
                attributes=self._player_attributes(player.attributes),
            )
            for player in context.players_by_team.get(team.id, [])
        ]
        stats = team.team_stats or {}
        return LockerTeam(
            id=team.id,
            nba_team_id=team.nba_team_id,
            name=team.name,
            abbreviation=team.abbreviation or "",
            season=team.season,
            statistics={
                "pace": float(stats.get("pace", 0.0)),
                "offensive_rating": float(stats.get("off_rtg", 0.0)),
                "defensive_rating": float(stats.get("def_rtg", 0.0)),
            },
            players=players,
            claim_status=claim_status,
        )

    def _player_attributes(self, attributes: dict[str, float]) -> dict[str, float]:
        """Map persisted catalog attribute names to domain field names.

        Args:
            attributes: Processed attributes stored on the player row.

        Returns:
            Attributes using stable snake-case names for API aliasing.
        """

        mapping = {
            "two_point_pct": "two_pt_pct",
            "three_point_pct": "three_pt_pct",
            "free_throw_pct": "ft_pct",
            "turnover_rate": "turnover_rate",
            "foul_rate": "foul_rate",
            "rebound_rate": "rebound_rate",
            "assist_rate": "assist_rate",
            "steal_rate": "steal_rate",
            "block_rate": "block_rate",
            "stamina": "stamina",
            "clutch_factor": "clutch_factor",
            "usage_rate": "usage_rate",
        }
        return {
            field: float(attributes.get(key, 0.0)) for field, key in mapping.items()
        }
