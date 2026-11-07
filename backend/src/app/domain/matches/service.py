"""Domain service that orchestrates a real match simulation."""

from __future__ import annotations

import asyncio
import uuid

from app.domain.matches.engine_adapter import MatchEngineAdapter
from app.domain.matches.repository import MatchRepository
from app.domain.matches.errors import InvalidIterationsError, SimulationFailedError
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
