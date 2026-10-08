from pydantic import BaseModel, Field


class TeamClaimRequest(BaseModel):
    """Payload for temporarily claiming a team in a session."""

    user_id: str = Field(min_length=1)
    team_id: str = Field(min_length=1)
