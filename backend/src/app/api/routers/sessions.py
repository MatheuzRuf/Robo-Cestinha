import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.factories import ServiceFactory
from app.api.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    JoinSessionRequest,
    SessionDescriptorResponse,
    SessionMembershipResponse,
    SessionParticipantResponse,
)
from app.domain.sessions.service import (
    SessionNotFoundError,
    SessionOwnerCannotLeaveError,
    SessionOwnerRequiredError,
    SessionParticipantNotFoundError,
)

router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(
    payload: CreateSessionRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> CreateSessionResponse:
    """Create a session, its owner, and the initial bracket.

    Args:
        payload: Owner display name.
        factory: Factory for request-scoped application services.

    Returns:
        Session and owner details in the frontend membership contract.

    Raises:
        HTTPException: If the catalog does not contain enough teams to generate
            the initial bracket.
    """

    try:
        session, owner = await factory.session_setup_service().create_session(
            owner_name=payload.owner_name,
            session_name=payload.session_name,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail="not_enough_teams") from error
    return CreateSessionResponse(
        session_hash=session.hash,
        owner_user_id=owner.id,
        owner_name=owner.name,
        session_name=session.name,
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
    return SessionDescriptorResponse(
        session_hash=session.hash,
        session_name=session.name,
        owner_user_id=session.owner_id,
    )


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
        session_name=session.name,
        team_id=None,
        last_visited_at=datetime.now(UTC).isoformat(),
    )


@router.delete("/{session_hash}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_hash: str,
    user_id: Annotated[uuid.UUID, Query()],
    factory: Annotated[ServiceFactory, Depends()],
) -> Response:
    """Delete a session and its tournament data as its owner.

    Args:
        session_hash: Public session code to delete.
        user_id: User requesting deletion.
        factory: Factory for request-scoped application services.

    Returns:
        An empty response after deletion.

    Raises:
        HTTPException: If the session does not exist or the requester is not
            its owner.
    """

    try:
        await factory.session_service().delete_session(session_hash, user_id)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    except SessionOwnerRequiredError as error:
        raise HTTPException(status_code=403, detail="session_owner_required") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{session_hash}/participants/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_session(
    session_hash: str,
    user_id: uuid.UUID,
    factory: Annotated[ServiceFactory, Depends()],
) -> Response:
    """Remove a non-owner participant from a session.

    Args:
        session_hash: Public session code to leave.
        user_id: Participant leaving the session.
        factory: Factory for request-scoped application services.

    Returns:
        An empty response after the participant has left.

    Raises:
        HTTPException: If the session or participant does not exist, or the
            owner attempts to leave instead of deleting the session.
    """

    try:
        await factory.session_service().leave_session(session_hash, user_id)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    except SessionParticipantNotFoundError as error:
        raise HTTPException(status_code=404, detail="participant_not_found") from error
    except SessionOwnerCannotLeaveError as error:
        raise HTTPException(status_code=409, detail="owner_cannot_leave") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{session_hash}/participants",
    response_model=list[SessionParticipantResponse],
)
async def get_session_participants(
    session_hash: str,
    factory: Annotated[ServiceFactory, Depends()],
) -> list[SessionParticipantResponse]:
    """Return persisted participants for a session roster.

    Args:
        session_hash: Public code for the requested session.
        factory: Factory for request-scoped application services.

    Returns:
        Participants ordered by their persisted join sequence.

    Raises:
        HTTPException: If no matching session exists.
    """

    try:
        participants = await factory.session_service().list_participants(session_hash)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    return [
        SessionParticipantResponse(
            user_id=participant.user_id,
            user_name=participant.user_name,
            join_sequence=participant.join_sequence,
            is_owner=participant.is_owner,
        )
        for participant in participants
    ]
