"""API schemas for match simulation, matching the frontend contract."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field, model_validator


class SimulateMatchRequest(BaseModel):
    """Payload for running a match simulation."""

    sessionHash: str = Field(min_length=1)
    iterations: int = Field(ge=1)


class MatchSummarySchema(BaseModel):
    """Brief match identity returned in the response."""

    matchId: uuid.UUID
    sessionHash: str
    status: str


class SimulationSummarySchema(BaseModel):
    """Iteration and termination details of the simulation."""

    status: str
    iterationsLimit: int
    iterationsCompleted: int
    overtimeIterations: int
    terminationReason: str


class SimulationTeamSchema(BaseModel):
    """A team in the response pair."""

    teamId: uuid.UUID
    nbaTeamId: int | None = None
    name: str
    abbreviation: str


class TeamPairSchema(BaseModel):
    """The home and away teams of the simulated match."""

    home: SimulationTeamSchema
    away: SimulationTeamSchema


class PlayerMetadataSchema(BaseModel):
    """Player metadata included once in the response."""

    playerId: uuid.UUID
    nbaPlayerId: int | None = None
    teamId: uuid.UUID
    side: str
    name: str
    position: str
    number: int | None = None


class PlayerPositionSchema(BaseModel):
    """One player coordinate inside a frame."""

    playerId: uuid.UUID
    x: int = Field(ge=0, le=94)
    y: int = Field(ge=0, le=50)


class TrajectorySchema(BaseModel):
    """Optional pass or shot path on a frame's ball."""

    type: str
    fromPosition: dict[str, int]
    toPosition: dict[str, int]
    fromPlayerId: uuid.UUID | None = None
    toPlayerId: uuid.UUID | None = None
    fromTeamId: uuid.UUID | None = None
    toTeamId: uuid.UUID | None = None
    progress: float


class BallSchema(BaseModel):
    """Ball state within a frame."""

    x: int = Field(ge=0, le=94)
    y: int = Field(ge=0, le=50)
    height: float | None = None
    trajectory: TrajectorySchema | None = None


class ScoreSchema(BaseModel):
    """Score snapshot within a frame."""

    home: int
    away: int


class SimulationFrameSchema(BaseModel):
    """One dense frame after a single game transition."""

    iteration: int
    playerWithBallId: uuid.UUID | None
    players: list[PlayerPositionSchema]
    ball: BallSchema
    score: ScoreSchema
    possessionTeamId: uuid.UUID | None


class SimulationEventSchema(BaseModel):
    """One ordered semantic event."""

    sequence: int
    iteration: int
    type: str
    teamId: uuid.UUID | None
    playerId: uuid.UUID | None
    targetPlayerId: uuid.UUID | None
    data: dict[str, Any]


class FinalMatchSummarySchema(BaseModel):
    """Final score and winner of the simulation."""

    homeScore: int
    awayScore: int
    winnerTeamId: uuid.UUID | None


class MatchSimulationResponse(BaseModel):
    """The full simulation response sent to the frontend."""

    match: MatchSummarySchema
    simulation: SimulationSummarySchema
    teams: TeamPairSchema
    players: list[PlayerMetadataSchema]
    frames: list[SimulationFrameSchema]
    events: list[SimulationEventSchema]
    summary: FinalMatchSummarySchema

    @model_validator(mode="after")
    def _validate_frames(self) -> MatchSimulationResponse:
        iterations = [frame.iteration for frame in self.frames]
        if iterations != list(range(len(self.frames))):
            raise ValueError("frame iterations must start at 0 and be contiguous")
        if len(self.frames) != self.simulation.iterationsCompleted + 1:
            raise ValueError("frame count must equal iterations completed plus one")
        for frame in self.frames:
            player_ids = {position.playerId for position in frame.players}
            if len(player_ids) != 10:
                raise ValueError("each frame must contain exactly ten players")
            if frame.playerWithBallId is not None and (
                frame.playerWithBallId not in player_ids
            ):
                raise ValueError("playerWithBallId must reference an on-court player")
        return self
