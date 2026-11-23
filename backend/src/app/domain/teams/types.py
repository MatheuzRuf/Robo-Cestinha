import uuid
from dataclasses import dataclass

from app.db.models import Player, Team, User


@dataclass(frozen=True)
class TeamLockerContext:
    """Persisted participant, bracket, and claim data for the team locker."""

    participant: User | None
    teams: list[Team]
    players_by_team: dict[uuid.UUID, list[Player]]
    team_claims: dict[uuid.UUID, uuid.UUID]
    eliminated_team_ids: set[uuid.UUID]
    bracket_generated: bool


@dataclass(frozen=True)
class LockerPlayer:
    """A catalog player shaped for team selection."""

    id: uuid.UUID
    nba_player_id: int | None
    name: str
    position: str
    position_group: str
    is_starter: bool
    attributes: dict[str, float]


@dataclass(frozen=True)
class LockerTeam:
    """A catalog team and its session-scoped claim status."""

    id: uuid.UUID
    nba_team_id: int | None
    name: str
    abbreviation: str
    season: str
    statistics: dict[str, float]
    players: list[LockerPlayer]
    claim_status: str


@dataclass(frozen=True)
class TeamLockerSnapshot:
    """Team locker response data for one participant and session."""

    session_hash: str
    teams: list[LockerTeam]
    my_team_id: uuid.UUID | None
    open_team_count: int
    total_team_count: int
