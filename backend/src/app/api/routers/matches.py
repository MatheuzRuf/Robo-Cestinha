import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.factories import ServiceFactory
from app.api.schemas.match_simulation import (
    FinalMatchSummarySchema,
    MatchSimulationResponse,
    MatchSummarySchema,
    PlayerMetadataSchema,
    SimulateMatchRequest,
    SimulationEventSchema,
    SimulationFrameSchema,
    SimulationSummarySchema,
    TeamPairSchema,
)
from app.domain.matches.errors import (
    InvalidIterationsError,
    MatchAlreadySimulatedError,
    MatchNotReadyError,
    MatchOrSessionNotFoundError,
    SimulationFailedError,
    SimulationNotFoundError,
)
from app.domain.matches.types import MatchSimulationResult

router = APIRouter()


def _build_response(result: MatchSimulationResult) -> MatchSimulationResponse:
    """Shape a simulation result into the frontend broadcast contract.

    Args:
        result: API-shaped match simulation result.

    Returns:
        The response validated against the shared broadcast schema.
    """

    return MatchSimulationResponse(
        match=MatchSummarySchema(
            matchId=result.match_id,
            sessionHash=result.session_hash,
            status="finished",
        ),
        simulation=SimulationSummarySchema(
            status="completed",
            iterationsLimit=result.iterations_limit,
            iterationsCompleted=result.iterations_completed,
            overtimeIterations=result.overtime_iterations,
            terminationReason=result.termination_reason,
        ),
        teams=TeamPairSchema(home=result.teams["home"], away=result.teams["away"]),
        players=[PlayerMetadataSchema(**player) for player in result.players],
        frames=[SimulationFrameSchema(**frame) for frame in result.frames],
        events=[SimulationEventSchema(**event) for event in result.events],
        summary=FinalMatchSummarySchema(
            homeScore=result.home_score,
            awayScore=result.away_score,
            winnerTeamId=result.winner_team_id,
        ),
    )


@router.post(
    "/{match_id}/simulation",
    response_model=MatchSimulationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def simulate_match(
    match_id: uuid.UUID,
    payload: SimulateMatchRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> MatchSimulationResponse:
    """Run and persist a real match simulation.

    Args:
        match_id: UUID of the match to simulate.
        payload: Session code and iteration limit from the request body.
        factory: Factory for request-scoped application services.

    Returns:
        The completed simulation matching the frontend broadcast contract.

    Raises:
        HTTPException: With a stable detail for each domain failure.
    """

    try:
        result = await factory.match_service().simulate_match(
            session_hash=payload.sessionHash,
            match_id=match_id,
            iterations=payload.iterations,
        )
    except MatchOrSessionNotFoundError as error:
        raise HTTPException(
            status_code=404, detail="match_or_session_not_found"
        ) from error
    except MatchNotReadyError as error:
        raise HTTPException(409, detail="match_not_ready") from error
    except MatchAlreadySimulatedError as error:
        raise HTTPException(409, detail="match_already_simulated") from error
    except InvalidIterationsError:
        raise HTTPException(422, detail="invalid_iterations")
    except SimulationFailedError:
        raise HTTPException(500, detail="simulation_failed")

    return _build_response(result)


@router.get(
    "/{match_id}/simulation",
    response_model=MatchSimulationResponse,
)
async def get_simulation(
    match_id: uuid.UUID,
    session_hash: Annotated[str, Query(min_length=1)],
    factory: Annotated[ServiceFactory, Depends()],
) -> MatchSimulationResponse:
    """Return a completed simulation for playback.

    Args:
        match_id: UUID of an already-simulated match.
        session_hash: Public session code that owns the match.
        factory: Factory for request-scoped application services.

    Returns:
        The stored simulation matching the frontend broadcast contract.

    Raises:
        HTTPException: 404 when no completed simulation exists.
    """

    try:
        result = await factory.match_service().get_simulation(
            session_hash=session_hash,
            match_id=match_id,
        )
    except SimulationNotFoundError as error:
        raise HTTPException(
            status_code=404, detail="simulation_not_found"
        ) from error

    return _build_response(result)
