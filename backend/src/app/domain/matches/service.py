"""Domain service that orchestrates a real match simulation."""

from __future__ import annotations

import asyncio
import uuid

from app.domain.matches.engine_adapter import MatchEngineAdapter
from app.domain.matches.errors import (
    InvalidIterationsError,
    SimulationFailedError,
    SimulationNotFoundError,
)
from app.domain.matches.repository import MatchRepository
from app.domain.matches.types import MatchSimulationResult


class MatchService:
    """Coordinate match readiness, engine execution, and result persistence."""

    def __init__(
        self,
        repository: MatchRepository,
        engine_adapter: MatchEngineAdapter,
        max_iterations: int,
    ) -> None:
        """Initialize the service with its collaborators.

        Args:
            repository: Repository used to load and persist matches.
            engine_adapter: Adapter that maps data to and from the engine.
            max_iterations: Upper bound enforced on requested iterations.
        """

        self._repository = repository
        self._engine_adapter = engine_adapter
        self._max_iterations = max_iterations

    async def simulate_match(
        self,
        session_hash: str,
        match_id: uuid.UUID,
        iterations: int,
    ) -> MatchSimulationResult:
        """Run and persist a simulated match.

        Args:
            session_hash: Public session code the match belongs to.
            match_id: Match to simulate.
            iterations: Maximum number of normal-play transitions.

        Returns:
            The completed simulation result.

        Raises:
            InvalidIterationsError: If the iteration count is out of bounds.
            MatchOrSessionNotFoundError: If the session or match cannot be found.
            MatchNotReadyError: If the match is not ready to simulate.
            MatchAlreadySimulatedError: If the match already has a simulation.
            SimulationFailedError: If the engine or persistence step fails.
        """

        if iterations < 1 or iterations > self._max_iterations:
            raise InvalidIterationsError(iterations)

        context = await self._repository.get_match_context(session_hash, match_id)
        reserved = await self._repository.reserve_simulation(match_id, iterations)

        try:
            engine_result = await asyncio.to_thread(
                self._engine_adapter.run,
                context,
                iterations,
                reserved.random_seed,
            )
            result = self._engine_adapter.to_domain_result(
                engine_result, context, iterations
            )
            await self._repository.complete_simulation(reserved.id, result)
        except Exception:
            await self._repository.fail_simulation(reserved.id, "engine_error")
            raise SimulationFailedError(match_id) from None

        return result

    async def get_simulation(
        self,
        session_hash: str,
        match_id: uuid.UUID,
    ) -> MatchSimulationResult:
        """Return a completed simulation for replay, if one exists.

        Args:
            session_hash: Public session code the match belongs to.
            match_id: Match to load the completed simulation for.

        Returns:
            The stored simulation shaped identically to a fresh run.

        Raises:
            SimulationNotFoundError: If no completed simulation exists.
        """

        view = await self._repository.get_simulation_view(session_hash, match_id)
        if view is None:
            raise SimulationNotFoundError(match_id)

        home_team, away_team = view.home_team, view.away_team
        return MatchSimulationResult(
            match_id=view.match.id,
            session_hash=session_hash,
            iterations_limit=view.simulation.iterations_limit,
            iterations_completed=view.simulation.iterations_completed,
            overtime_iterations=view.simulation.overtime_iterations,
            termination_reason=view.simulation.termination_reason or "",
            home_score=view.match.home_score,
            away_score=view.match.away_score,
            winner_team_id=view.match.winner_team_id,
            teams={
                "home": {
                    "teamId": home_team.id,
                    "name": home_team.name,
                    "abbreviation": home_team.abbreviation,
                },
                "away": {
                    "teamId": away_team.id,
                    "name": away_team.name,
                    "abbreviation": away_team.abbreviation,
                },
            },
            players=list(self._players_payload(view)),
            frames=view.frames,
            events=view.events,
        )

    @staticmethod
    def _players_payload(view) -> list[dict[str, object]]:
        """Build player metadata in the API shape from a stored match view.

        Args:
            view: Loaded simulation view with both rosters.

        Returns:
            Player rows with side, name, position, and number metadata.
        """

        def rows(side: str, team, players):
            for player in players:
                yield {
                    "playerId": player.id,
                    "teamId": player.team_id,
                    "side": side,
                    "name": player.name,
                    "position": player.position5 or player.position,
                    "number": None,
                }

        return list(rows("home", view.home_team, view.home_players)) + list(
            rows("away", view.away_team, view.away_players)
        )
