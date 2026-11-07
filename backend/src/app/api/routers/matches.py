from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Query

from app.api.factories import ServiceFactory
from app.api.schemas.match_timeline import MatchTimelineResponse

router = APIRouter()


@router.get("/{match_id}/timeline", response_model=MatchTimelineResponse)
async def get_match_timeline(
    match_id: str,
    factory: Annotated[ServiceFactory, Depends()],
    locale: str = Query(default="en-US", min_length=2, max_length=10),
) -> MatchTimelineResponse:
    """Return a complete mock match timeline payload for the frontend.

    Args:
        match_id: Match identifier to resolve.
        locale: Preferred locale for the narration bundle.
        factory: Request-scoped service factory.

    Returns:
        The complete timeline, frames, and event metadata used by the broadcast.
    """

    service = factory.mock_timeline_service()
    payload = service.get_timeline(match_id=match_id, locale=locale)
    return MatchTimelineResponse(**payload)


@router.post("/{match_id}/simulation")
async def simulate_match(
    match_id: str,
    factory: Annotated[ServiceFactory, Depends()],
    session_hash: str = Body(..., alias="sessionHash", min_length=1),
    iterations: int = Body(..., gt=0),
) -> dict[str, Any]:
    """Return a seeded mock simulation for the requested match.

    Args:
        match_id: Match identifier from the route.
        session_hash: Session identifier sent in the request body.
        iterations: Maximum number of generated frame transitions.
        factory: Request-scoped service factory.

    Returns:
        A simulation result with frames, events, and final score.
    """

    service = factory.mock_simulation_service()
    return service.run_simulation(
        match_id=match_id,
        session_hash=session_hash,
        iterations=iterations,
    )
