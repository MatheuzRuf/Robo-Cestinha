import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.factories import ServiceFactory
from app.api.schemas.team import TeamClaimRequest, TeamLockerResponse
from app.domain.sessions.service import SessionNotFoundError
from app.domain.teams.errors import (
    AlreadyClaimedError,
    BracketNotGeneratedError,
    ParticipantNotFoundError,
    TeamNotFoundError,
    TeamUnavailableError,
)
from app.domain.teams.types import TeamLockerSnapshot

router = APIRouter()


def _build_response(snapshot: TeamLockerSnapshot) -> TeamLockerResponse:
    """Validate a domain snapshot against the frontend team locker contract.

    Args:
        snapshot: Persisted team locker data from the domain service.

    Returns:
        The response validated against the team locker API schema.
    """

    return TeamLockerResponse.model_validate(snapshot)


@router.get(
    "/{session_hash}/team-locker",
    response_model=TeamLockerResponse,
)
async def get_team_locker(
    session_hash: str,
    user_id: Annotated[uuid.UUID, Query()],
    factory: Annotated[ServiceFactory, Depends()],
) -> TeamLockerResponse:
    """Return persisted teams and claims for a session participant.

    Args:
        session_hash: Public session code whose locker is requested.
        user_id: Participant viewing the locker.
        factory: Factory for request-scoped application services.

    Returns:
        Team roster, claim statuses, and summary counts.

    Raises:
        HTTPException: If the session, participant, or generated bracket is missing.
    """

    try:
        snapshot = await factory.team_locker_service().get_locker(session_hash, user_id)
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    except ParticipantNotFoundError as error:
        raise HTTPException(status_code=404, detail="participant_not_found") from error
    except BracketNotGeneratedError as error:
        raise HTTPException(status_code=409, detail="bracket_not_generated") from error
    return _build_response(snapshot)


@router.post(
    "/{session_hash}/team-locker/claim",
    response_model=TeamLockerResponse,
    status_code=status.HTTP_200_OK,
)
async def claim_team(
    session_hash: str,
    payload: TeamClaimRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> TeamLockerResponse:
    """Persist an available team selection and return the refreshed locker.

    Args:
        session_hash: Public session code containing the locker.
        payload: Participant and team identifiers.
        factory: Factory for request-scoped application services.

    Returns:
        The refreshed locker snapshot after the claim.

    Raises:
        HTTPException: If the session, participant, bracket, or team is invalid,
            or the participant/team is already claimed.
    """

    try:
        snapshot = await factory.team_locker_service().claim_team(
            session_hash=session_hash,
            user_id=payload.user_id,
            team_id=payload.team_id,
        )
    except SessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="session_not_found") from error
    except ParticipantNotFoundError as error:
        raise HTTPException(status_code=404, detail="participant_not_found") from error
    except BracketNotGeneratedError as error:
        raise HTTPException(status_code=409, detail="bracket_not_generated") from error
    except AlreadyClaimedError as error:
        raise HTTPException(status_code=409, detail="already_claimed") from error
    except TeamNotFoundError as error:
        raise HTTPException(status_code=404, detail="team_not_found") from error
    except TeamUnavailableError as error:
        raise HTTPException(status_code=409, detail="team_unavailable") from error
    return _build_response(snapshot)
