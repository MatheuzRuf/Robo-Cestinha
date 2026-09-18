import uuid

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    """Payload for creating a new session."""

    owner_name: str


class CreateSessionResponse(BaseModel):
    """Response returned after creating a session."""

    session_hash: str
    owner_user_id: uuid.UUID
