import uuid

from pydantic import BaseModel, ConfigDict, Field


class TeamClaimRequest(BaseModel):
    """Payload for claiming a team in a session."""

    user_id: uuid.UUID
    team_id: uuid.UUID


class LockerPlayerAttributesResponse(BaseModel):
    """Simulation attributes shown for a player in the team locker."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    two_point_pct: float = Field(alias="twoPointPct")
    three_point_pct: float = Field(alias="threePointPct")
    free_throw_pct: float = Field(alias="freeThrowPct")
    turnover_rate: float = Field(alias="turnoverRate")
    foul_rate: float = Field(alias="foulRate")
    rebound_rate: float = Field(alias="reboundRate")
    assist_rate: float = Field(alias="assistRate")
    steal_rate: float = Field(alias="stealRate")
    block_rate: float = Field(alias="blockRate")
    stamina: float
    clutch_factor: float = Field(alias="clutchFactor")
    usage_rate: float = Field(alias="usageRate")


class LockerPlayerResponse(BaseModel):
    """A persisted catalog player in the team locker response."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    nba_player_id: int | None = Field(default=None, alias="nbaPlayerId")
    name: str
    position: str
    position_group: str = Field(alias="positionGroup")
    is_starter: bool = Field(alias="isStarter")
    attributes: LockerPlayerAttributesResponse


class LockerTeamStatisticsResponse(BaseModel):
    """Persisted team statistics in the team locker response."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    pace: float
    offensive_rating: float = Field(alias="offensiveRating")
    defensive_rating: float = Field(alias="defensiveRating")


class LockerTeamResponse(BaseModel):
    """A persisted team and its claim state."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    nba_team_id: int | None = Field(default=None, alias="nbaTeamId")
    name: str
    abbreviation: str
    season: str
    statistics: LockerTeamStatisticsResponse
    players: list[LockerPlayerResponse]
    claim_status: str = Field(alias="claimStatus")


class TeamLockerResponse(BaseModel):
    """Session team locker snapshot returned to the frontend."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    session_hash: str = Field(alias="sessionHash")
    teams: list[LockerTeamResponse]
    my_team_id: uuid.UUID | None = Field(alias="myTeamId")
    open_team_count: int = Field(alias="openTeamCount")
    total_team_count: int = Field(alias="totalTeamCount")
