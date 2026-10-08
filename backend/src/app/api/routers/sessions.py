from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.factories import ServiceFactory
from app.api.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    JoinSessionRequest,
    SessionDescriptorResponse,
    SessionMembershipResponse,
)
from app.domain.sessions.service import SessionNotFoundError

router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(
    payload: CreateSessionRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> CreateSessionResponse:
    """Create a session and its owner using the session service.

    Args:
        payload: Owner display name.
        factory: Factory for request-scoped application services.

    Returns:
        Session and owner details in the frontend membership contract.
    """

    service = factory.session_service()
    session, owner = await service.create_session(owner_name=payload.owner_name)
    return CreateSessionResponse(
        session_hash=session.hash,
        owner_user_id=owner.id,
        owner_name=owner.name,
        team_id=None,
        last_visited_at=datetime.now(UTC).isoformat(),
    )


@router.get("/{session_hash}", response_model=SessionDescriptorResponse)
async def get_session(
    session_hash: str,
    factory: Annotated[ServiceFactory, Depends()],
) -> SessionDescriptorResponse:
    """Look up a session by its public code.

    Args:
        session_hash: Public session code to find.
        factory: Factory for request-scoped application services.

    Returns:
        The public session descriptor.

    Raises:
        HTTPException: If no matching session exists.
    """

    try:
        session = await factory.session_service().get_session(session_hash)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    return SessionDescriptorResponse(session_hash=session.hash)


@router.post("/{session_hash}/join", response_model=SessionMembershipResponse)
async def join_session(
    session_hash: str,
    payload: JoinSessionRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> SessionMembershipResponse:
    """Add a participant to a persisted session.

    Args:
        session_hash: Public session code to join.
        payload: Participant display name.
        factory: Factory for request-scoped application services.

    Returns:
        The session and new participant membership.

    Raises:
        HTTPException: If no matching session exists.
    """

    try:
        session, user = await factory.session_service().join_session(
            session_hash, payload.user_name
        )
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error

    return SessionMembershipResponse(
        session_hash=session.hash,
        user_id=user.id,
        user_name=user.name,
        team_id=None,
        last_visited_at=datetime.now(UTC).isoformat(),
    )
