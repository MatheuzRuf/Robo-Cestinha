from fastapi import APIRouter, Depends

from app.api.schemas.session import CreateSessionRequest, CreateSessionResponse
from app.api.factories import ServiceFactory


router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(
    payload: CreateSessionRequest,
    factory: ServiceFactory = Depends(),
) -> CreateSessionResponse:
    """Create a new session from the request payload.

    Args:
        payload: Request body containing the owner name.
        factory: Factory for request-scoped application services.

    Returns:
        The public session hash and owner user ID.
    """

    service = factory.session_service()
    session, owner = await service.create_session(owner_name=payload.owner_name)
    return CreateSessionResponse(session_hash=session.hash, owner_user_id=owner.id)
