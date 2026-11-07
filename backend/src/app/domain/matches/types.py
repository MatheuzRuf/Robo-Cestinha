"""Plain data types shared by the match domain (no FastAPI or Pydantic)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class MatchContext:
    """Everything the engine needs about a single match."""

    match_id: uuid.UUID
    session_id: uuid.UUID
    session_hash: str
    match: Any
    home_team: Any
    away_team: Any
    home_players: list[Any]
    away_players: list[Any]


@dataclass
class SimulationRecord:
    """The reserved simulation row created before the engine runs."""

    id: uuid.UUID
    random_seed: int | None = None


@dataclass
class MatchSimulationResult:
    """The outcome of a match simulation, API-shaped and ready to return."""

    match_id: uuid.UUID
    session_hash: str
    iterations_limit: int
    iterations_completed: int
    overtime_iterations: int
    termination_reason: str
    home_score: int
    away_score: int
    winner_team_id: uuid.UUID
    teams: dict[str, Any] = field(default_factory=dict)
    players: list[dict[str, Any]] = field(default_factory=list)
    frames: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    engine_version: str = ""


@dataclass
class EngineIdMap:
    """Map engine (catalog) ids back to persisted database ids."""

    team_id_by_engine: dict[str, uuid.UUID]
    player_id_by_engine: dict[str, uuid.UUID]
