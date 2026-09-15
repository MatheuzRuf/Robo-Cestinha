from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.session import CreateSessionRequest, CreateSessionResponse
from app.db.base import get_db
from app.domain.sessions.service import create_session as create_session_service


router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(payload: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    """Create a new session from the request payload.

    Args:
        payload: Request body containing the owner name.
        db: Active async database session.

    Returns:
        The public session hash and owner user ID.
    """

    session, owner = await create_session_service(db, owner_name=payload.owner_name)
    return CreateSessionResponse(session_hash=session.hash, owner_user_id=owner.id)
