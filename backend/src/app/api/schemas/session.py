import uuid

from pydantic import AliasChoices, BaseModel, Field, field_validator


class CreateSessionRequest(BaseModel):
    """Payload for creating a new session."""

    owner_name: str = Field(min_length=1, max_length=24)
    session_name: str = Field(default="Tournament", min_length=1, max_length=48)

    @field_validator("session_name", mode="before")
    @classmethod
    def strip_session_name(cls, value: object) -> object:
        """Trim a session name before applying length constraints.

        Args:
            value: Submitted tournament name.

        Returns:
            The trimmed tournament name.
        """

        return value.strip() if isinstance(value, str) else value


class CreateSessionResponse(BaseModel):
    """Response returned after creating a session."""

    session_hash: str
    owner_user_id: uuid.UUID
    owner_name: str
    session_name: str
    team_id: str | None = None
    last_visited_at: str


class SessionDescriptorResponse(BaseModel):
    """Public session details returned by the session lookup route."""

    session_hash: str
    session_name: str
    owner_user_id: uuid.UUID | None = None


class JoinSessionRequest(BaseModel):
    """Payload for adding a participant to a session."""

    user_name: str = Field(
        min_length=1,
        max_length=24,
        validation_alias=AliasChoices("user_name", "name"),
    )

    @field_validator("user_name", mode="before")
    @classmethod
    def strip_user_name(cls, value: object) -> object:
        """Trim a participant display name before applying length constraints.

        Args:
            value: Submitted participant display name.

        Returns:
            The trimmed participant name.
        """

        return value.strip() if isinstance(value, str) else value


class SessionMembershipResponse(BaseModel):
    """Session and participant details returned after joining."""

    session_hash: str
    user_id: uuid.UUID
    user_name: str
    session_name: str
    team_id: str | None = None
    last_visited_at: str


class SessionParticipantResponse(BaseModel):
    """A persisted participant returned by the session roster endpoint."""

    user_id: uuid.UUID
    user_name: str
    join_sequence: int
    is_owner: bool
