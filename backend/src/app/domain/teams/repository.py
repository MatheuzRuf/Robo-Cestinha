import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models import Match, Player, Team, User
from app.domain.base_repository import BaseRepository
from app.domain.teams.errors import (
    AlreadyClaimedError,
    ParticipantNotFoundError,
    TeamClaimConflictError,
)
from app.domain.teams.types import TeamLockerContext


class TeamRepository(BaseRepository):
    """Load team locker data and persist session-scoped selections."""

    async def get_locker_context(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> TeamLockerContext:
        """Load participant, bracket teams, roster, and persisted claims.

        Args:
            session_id: Session whose bracket and claims should be read.
            user_id: Participant requesting the locker.

        Returns:
            The persisted context required to construct the locker snapshot.
        """

        participant_result = await self._db.execute(
            select(User).where(User.session_id == session_id, User.id == user_id)
        )
        participant = participant_result.scalar_one_or_none()

        match_result = await self._db.execute(
            select(Match)
            .where(Match.session_id == session_id, Match.round == 0)
            .order_by(Match.slot_in_round)
        )
        first_round_matches = list(match_result.scalars().all())
        team_ids = list(
            dict.fromkeys(
                team_id
                for match in first_round_matches
                for team_id in (match.home_team_id, match.away_team_id)
                if team_id is not None
            )
        )

        teams: list[Team] = []
        players_by_team: dict[uuid.UUID, list[Player]] = {}
        team_claims: dict[uuid.UUID, uuid.UUID] = {}
        eliminated_team_ids: set[uuid.UUID] = set()

        if team_ids:
            team_result = await self._db.execute(
                select(Team).where(Team.id.in_(team_ids))
            )
            teams_by_id = {team.id: team for team in team_result.scalars().all()}
            teams = [
                teams_by_id[team_id] for team_id in team_ids if team_id in teams_by_id
            ]

            player_result = await self._db.execute(
                select(Player)
                .where(Player.team_id.in_(team_ids))
                .order_by(
                    Player.team_id,
                    Player.is_starter.desc(),
                    Player.name,
                    Player.id,
                )
            )
            for player in player_result.scalars().all():
                players_by_team.setdefault(player.team_id, []).append(player)

            claim_result = await self._db.execute(
                select(User).where(
                    User.session_id == session_id,
                    User.team_id.in_(team_ids),
                )
            )
            team_claims = {
                user.team_id: user.id
                for user in claim_result.scalars().all()
                if user.team_id is not None
            }

            finished_result = await self._db.execute(
                select(Match).where(
                    Match.session_id == session_id,
                    Match.status == "finished",
                )
            )
            for match in finished_result.scalars().all():
                for team_id in (match.home_team_id, match.away_team_id):
                    if team_id in team_ids and match.winner_team_id != team_id:
                        eliminated_team_ids.add(team_id)

        return TeamLockerContext(
            participant=participant,
            teams=teams,
            players_by_team=players_by_team,
            team_claims=team_claims,
            eliminated_team_ids=eliminated_team_ids,
            bracket_generated=bool(first_round_matches),
        )

    async def claim_team(
        self, session_id: uuid.UUID, user_id: uuid.UUID, team_id: uuid.UUID
    ) -> None:
        """Assign a team to a participant with database concurrency protection.

        Args:
            session_id: Session containing the participant and team.
            user_id: Participant claiming the team.
            team_id: Bracket team to claim.

        Raises:
            ParticipantNotFoundError: If the participant is not in the session.
            AlreadyClaimedError: If the participant already selected a team.
            TeamClaimConflictError: If another participant claimed the team first.
        """

        result = await self._db.execute(
            select(User)
            .where(User.session_id == session_id, User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        participant = result.scalar_one_or_none()
        if participant is None:
            raise ParticipantNotFoundError(user_id)
        if participant.team_id is not None:
            raise AlreadyClaimedError(user_id)

        participant.team_id = team_id
        try:
            await self.flush()
            await self.commit()
        except IntegrityError as error:
            constraint_name = getattr(
                getattr(error.orig, "diag", None), "constraint_name", None
            )
            await self.rollback()
            if constraint_name == "uq_users_session_team":
                raise TeamClaimConflictError(team_id) from error
            raise
