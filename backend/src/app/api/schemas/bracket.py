import uuid

from pydantic import BaseModel


class GenerateBracketRequest(BaseModel):
    """Payload for generating a session bracket."""

    user_id: uuid.UUID


class BracketTeamResponse(BaseModel):
    """A team assigned to a bracket slot."""

    id: uuid.UUID
    name: str


class BracketMatchResponse(BaseModel):
    """A match and its assigned teams."""

    match_id: uuid.UUID | None
    slot: int
    home_team: BracketTeamResponse | None
    away_team: BracketTeamResponse | None


class BracketRoundResponse(BaseModel):
    """Matches in one bracket round."""

    round_number: int
    matches: list[BracketMatchResponse]


class BracketResponse(BaseModel):
    """Bracket state returned to a session participant."""

    generated: bool
    can_generate: bool
    rounds: list[BracketRoundResponse]
