import uuid

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    """Payload for creating a new session."""

    owner_name: str = Field(min_length=1, max_length=24)


class CreateSessionResponse(BaseModel):
    """Response returned after creating a session."""

    session_hash: str
    owner_user_id: uuid.UUID
    owner_name: str
    team_id: str | None = None
    last_visited_at: str


class SessionDescriptorResponse(BaseModel):
    """Public session details returned by the session lookup route."""

    session_hash: str
    session_name: str | None = None


class JoinSessionRequest(BaseModel):
    """Payload for adding a participant to a session."""

    user_name: str = Field(min_length=1, max_length=24)


class SessionMembershipResponse(BaseModel):
    """Session and participant details returned after joining."""

    session_hash: str
    user_id: uuid.UUID
    user_name: str
    team_id: str | None = None
    last_visited_at: str
