"""Match-related persistence, owned exclusively by this repository."""

from __future__ import annotations

import random
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Match,
    MatchEvent,
    MatchFrameChunk,
    MatchSimulation,
    Player,
    Session,
    Team,
)
from app.domain.base_repository import BaseRepository
from app.domain.matches.errors import (
    MatchAlreadySimulatedError,
    MatchNotReadyError,
    MatchOrSessionNotFoundError,
)
from app.domain.matches.types import (
    MatchContext,
    MatchSimulationResult,
    SimulationRecord,
)


class MatchRepository(BaseRepository):
    """Persist and retrieve matches, teams, players, and simulations."""

    async def get_match_context(
        self,
        session_hash: str,
        match_id: uuid.UUID,
    ) -> MatchContext:
        """Load the session, match, teams, and players for a simulation.

        Args:
            session_hash: Public session code the match must belong to.
            match_id: Match identifier to load.

        Returns:
            The match context needed to run the engine.

        Raises:
            MatchOrSessionNotFoundError: If the session or matching match is missing.
            MatchNotReadyError: If a team, its roster, or readiness is incomplete.
        """

        session = await self._get_session_by_hash(session_hash)
        if session is None:
            raise MatchOrSessionNotFoundError(match_id)
        match = await self._get_match(match_id)
        if match is None or match.session_id != session.id:
            raise MatchOrSessionNotFoundError(match_id)
        if match.status != "ready":
            raise MatchNotReadyError(match_id)

        home_team = await self._get_team(match.home_team_id)
        away_team = await self._get_team(match.away_team_id)
        if home_team is None or away_team is None:
            raise MatchNotReadyError(match_id)

        home_players = await self._get_players(home_team.id)
        away_players = await self._get_players(away_team.id)
        if not home_players or not away_players:
            raise MatchNotReadyError(match_id)

        return MatchContext(
            match_id=match.id,
            session_id=session.id,
            session_hash=session.hash,
            match=match,
            home_team=home_team,
            away_team=away_team,
            home_players=home_players,
            away_players=away_players,
        )

    async def reserve_simulation(
        self,
        match_id: uuid.UUID,
        iterations: int,
    ) -> SimulationRecord:
        """Create and commit a single running simulation for a match.

        Args:
            match_id: Match to reserve a simulation for.
            iterations: Requested iteration limit.

        Returns:
            The reserved simulation record.

        Raises:
            MatchAlreadySimulatedError: If a simulation already exists for the match.
        """

        await self._get_match(match_id, for_update=True)
        existing = await self._get_simulation_by_match_id(match_id)
        if existing is not None:
            raise MatchAlreadySimulatedError(match_id)

        record = MatchSimulation(
            match_id=match_id,
            status="running",
            iterations_limit=iterations,
            iterations_completed=0,
            overtime_iterations=0,
            random_seed=random.randrange(0, 2**31),
            started_at=datetime.now(UTC),
        )
        await self.add(record)
        try:
            await self.flush()
        except IntegrityError as error:
            raise MatchAlreadySimulatedError(match_id) from error
        await self.commit()
        return SimulationRecord(id=record.id, random_seed=record.random_seed)

    async def complete_simulation(
        self,
        simulation_id: uuid.UUID,
        result: MatchSimulationResult,
    ) -> None:
        """Persist a finished simulation, match result, and bracket advance.

        Args:
            simulation_id: Simulation to mark as completed.
            result: Computed simulation outcome.

        Raises:
            MatchOrSessionNotFoundError: If the simulation or match is missing.
        """

        simulation = await self._get_simulation_by_id(simulation_id)
        if simulation is None:
            raise MatchOrSessionNotFoundError(simulation_id)
        simulation.status = "completed"
        simulation.iterations_completed = result.iterations_completed
        simulation.overtime_iterations = result.overtime_iterations
        simulation.termination_reason = result.termination_reason
        simulation.engine_version = result.engine_version
        simulation.completed_at = datetime.now(UTC)

        await self.add_all(
            [
                MatchEvent(
                    simulation_id=simulation.id,
                    sequence=event["sequence"],
                    iteration=event["iteration"],
                    type=event["type"],
                    team_id=_to_uuid(event.get("teamId")),
                    player_id=_to_uuid(event.get("playerId")),
                    target_player_id=_to_uuid(event.get("targetPlayerId")),
                    payload=event.get("data") or {},
                )
                for event in result.events
            ]
        )
        if result.frames:
            await self.add(
                MatchFrameChunk(
                    simulation_id=simulation.id,
                    chunk_index=0,
                    first_iteration=0,
                    frame_count=len(result.frames),
                    frames=result.frames,
                )
            )

        match = await self._get_match(result.match_id)
        if match is None:
            raise MatchOrSessionNotFoundError(result.match_id)
        match.home_score = result.home_score
        match.away_score = result.away_score
        match.winner_team_id = result.winner_team_id
        match.status = "finished"

        if match.next_match_id is not None:
            next_match = await self._get_match(match.next_match_id)
            slot = match.next_match_slot
            if next_match is not None and slot:
                setattr(next_match, f"{slot}_team_id", result.winner_team_id)
                if next_match.home_team_id and next_match.away_team_id:
                    next_match.status = "ready"

        await self.commit()

    async def fail_simulation(
        self,
        simulation_id: uuid.UUID,
        error_code: str,
    ) -> None:
        """Mark a simulation as failed without touching the bracket.

        Args:
            simulation_id: Simulation to mark as failed.
            error_code: Stable code describing the failure.
        """

        simulation = await self._get_simulation_by_id(simulation_id)
        if simulation is None:
            return
        simulation.status = "failed"
        simulation.termination_reason = error_code
        simulation.completed_at = datetime.now(UTC)
        await self.commit()

    async def _get_session_by_hash(self, session_hash: str) -> Session | None:
        normalized = session_hash.strip().upper()
        statement = select(Session).where(
            func.upper(Session.hash).in_((normalized, f"#{normalized}"))
        )
        result = await self._db.execute(statement)
        return result.scalar_one_or_none()

    async def _get_match(
        self, match_id: uuid.UUID, *, for_update: bool = False
    ) -> Match | None:
        statement = select(Match).where(Match.id == match_id)
        if for_update:
            statement = statement.with_for_update()
        result = await self._db.execute(statement)
        return result.scalar_one_or_none()

    async def _get_team(self, team_id) -> Team | None:
        if team_id is None:
            return None
        result = await self._db.execute(select(Team).where(Team.id == team_id))
        return result.scalar_one_or_none()

    async def _get_players(self, team_id) -> list[Player]:
        result = await self._db.execute(select(Player).where(Player.team_id == team_id))
        return list(result.scalars().all())

    async def _get_simulation_by_id(
        self, simulation_id: uuid.UUID
    ) -> MatchSimulation | None:
        result = await self._db.execute(
            select(MatchSimulation).where(MatchSimulation.id == simulation_id)
        )
        return result.scalar_one_or_none()

    async def _get_simulation_by_match_id(
        self, match_id: uuid.UUID
    ) -> MatchSimulation | None:
        result = await self._db.execute(
            select(MatchSimulation).where(MatchSimulation.match_id == match_id)
        )
        return result.scalar_one_or_none()


def _to_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))
