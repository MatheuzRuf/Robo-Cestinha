from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends

from app.api.factories import ServiceFactory

router = APIRouter()


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
