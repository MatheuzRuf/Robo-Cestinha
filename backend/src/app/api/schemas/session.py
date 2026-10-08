import uuid
from typing import Literal

from pydantic import BaseModel, Field


class SessionSettingsPayload(BaseModel):
    """Simulation settings selected when a participant creates a session."""

    sim_speed: Literal["normal", "blitz"] = "normal"
    quarter_length: Literal["3", "5"] = "3"
    auto_fill: bool = True


class CreateSessionRequest(BaseModel):
    """Payload for creating a new session."""

    owner_name: str = Field(min_length=1, max_length=24)
    settings: SessionSettingsPayload = Field(default_factory=SessionSettingsPayload)


class CreateSessionResponse(BaseModel):
    """Response returned after creating a session."""

    session_hash: str
    owner_user_id: uuid.UUID
    owner_name: str
    team_id: str | None = None
    last_visited_at: str
    settings: SessionSettingsPayload


class SessionDescriptorResponse(BaseModel):
    """Public session details returned by lookup and featured-session routes."""

    session_hash: str
    session_name: str | None = None


class FeaturedSessionsResponse(BaseModel):
    """Sample session codes exposed by the temporary featured-sessions route."""

    session_hashes: list[str]


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
    settings: SessionSettingsPayload | None = None


class TeamClaimRequest(BaseModel):
    """Payload for temporarily claiming a team in a session."""

    user_id: str = Field(min_length=1)
    team_id: str = Field(min_length=1)
