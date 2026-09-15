from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.session import CreateSessionRequest, CreateSessionResponse
from app.db.base import get_db


router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(payload: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    raise NotImplementedError("Session creation service not yet implemented")
