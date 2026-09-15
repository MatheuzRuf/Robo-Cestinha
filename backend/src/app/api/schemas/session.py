import uuid

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    owner_name: str


class CreateSessionResponse(BaseModel):
    session_hash: str
    owner_user_id: uuid.UUID
