import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.factories import ServiceFactory
from app.api.schemas.bracket import BracketResponse, GenerateBracketRequest
from app.domain.bracket.service import (
    BracketAlreadyGeneratedError,
    BracketOwnerRequiredError,
)
from app.domain.sessions.service import SessionNotFoundError

router = APIRouter()


@router.get("/{session_hash}", response_model=BracketResponse)
async def get_bracket(
    session_hash: str,
    user_id: Annotated[uuid.UUID, Query()],
    factory: Annotated[ServiceFactory, Depends()],
) -> BracketResponse:
    """Return a session bracket or its empty skeleton.

    Args:
        session_hash: Public session code to load.
        user_id: Participant used to determine whether they can generate the bracket.
        factory: Factory for request-scoped application services.

    Returns:
        The bracket and whether the participant can generate it.

    Raises:
        HTTPException: If the session does not exist.
    """

    try:
        payload = await factory.bracket_service().get_bracket(session_hash, user_id)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    return BracketResponse(**payload)


@router.post("/{session_hash}", response_model=BracketResponse)
async def generate_bracket(
    session_hash: str,
    payload: GenerateBracketRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> BracketResponse:
    """Generate and return a session bracket.

    Args:
        session_hash: Public session code to generate a bracket for.
        payload: Participant requesting bracket generation.
        factory: Factory for request-scoped application services.

    Returns:
        The newly generated bracket.

    Raises:
        HTTPException: If the session is missing, the requester is not its owner,
            a bracket already exists, or the catalog lacks enough teams.
    """

    try:
        result = await factory.bracket_service().generate_bracket(
            session_hash, payload.user_id
        )
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    except BracketOwnerRequiredError as error:
        raise HTTPException(status_code=403, detail="session_owner_required") from error
    except BracketAlreadyGeneratedError as error:
        raise HTTPException(
            status_code=409, detail="bracket_already_generated"
        ) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail="not_enough_teams") from error
    return BracketResponse(**result)
