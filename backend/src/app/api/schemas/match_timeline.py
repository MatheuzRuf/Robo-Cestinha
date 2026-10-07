"""Pydantic models for the mock timeline contract used by the API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MatchPlayerSchema(BaseModel):
    """Player state at a point in the match."""

    id: str
    team: str
    x: float
    y: float
    name: str
    number: int
    position: str


class MatchBallSchema(BaseModel):
    """Ball position in court coordinates."""

    x: float
    y: float


class MatchFrameSchema(BaseModel):
    """A single frame snapshot from the timeline."""

    players: list[MatchPlayerSchema] = Field(default_factory=list)
    ball: MatchBallSchema
    trajectory: dict[str, Any] | None = None


class TeamSummarySchema(BaseModel):
    """Current scoreboard information for a team."""

    abbreviation: str
    name: str
    score: int
    seed: str
    possession: bool
    fouls: dict[str, int] = Field(default_factory=lambda: {"current": 0, "max": 5})
    timeouts: dict[str, int] = Field(default_factory=lambda: {"remaining": 0, "total": 3})


class MomentumSnapshotSchema(BaseModel):
    """A compact momentum summary shown in the UI."""

    runLabel: str
    runDelta: str
    homePoints: int
    awayPoints: int
    stats: list[list[str]] = Field(default_factory=list)


class PlayByPlayEntrySchema(BaseModel):
    """One play-by-play entry for the current match."""

    id: str
    gameClock: str
    type: str
    description: str


class CommentaryEntrySchema(BaseModel):
    """Single commentary line displayed on the broadcast."""

    id: str
    gameClock: str
    text: str


class TimelineEventSchema(BaseModel):
    """A timeline event that is associated with a state change."""

    id: str
    sequence: int
    occurredAt: str
    type: str
    gameClock: str
    description: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class NarrationEntrySchema(BaseModel):
    """Narration slot for an event and locale."""

    eventId: str
    locale: str = "en-US"
    text: str


class MatchTimelineResponse(BaseModel):
    """Full mock match payload returned by the backend timeline endpoint."""

    matchId: str
    matchMeta: str
    ticker: str
    home: TeamSummarySchema
    away: TeamSummarySchema
    playCall: str
    shotProbability: int
    defensiveScheme: str
    quarter: int
    gameClock: str
    shotClock: str
    elapsedSeconds: int
    durationSeconds: int
    momentum: MomentumSnapshotSchema
    frame: MatchFrameSchema
    frames: list[MatchFrameSchema] = Field(default_factory=list)
    playByPlay: list[PlayByPlayEntrySchema] = Field(default_factory=list)
    commentary: list[CommentaryEntrySchema] = Field(default_factory=list)
    events: list[TimelineEventSchema] = Field(default_factory=list)
    narration: list[NarrationEntrySchema] = Field(default_factory=list)
