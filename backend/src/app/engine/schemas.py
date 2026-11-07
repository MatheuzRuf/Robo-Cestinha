"""Modelos Pydantic usados pela simulação e pelos logs da partida.

Eles formam o contrato JSON entre o engine, interfaces de visualização e
módulos que narram ou persistem a partida.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class PlayerBoxScore(BaseModel):
    """Estatísticas acumuladas de um jogador durante a partida."""

    pts: int = 0
    reb: int = 0
    oreb: int = 0
    dreb: int = 0
    ast: int = 0
    stl: int = 0
    blk: int = 0
    tov: int = 0
    pf: int = 0
    fga: int = 0
    fgm: int = 0
    fg3a: int = 0
    fg3m: int = 0
    fta: int = 0
    ftm: int = 0
    seconds_played: float = 0.0


class TeamBoxScore(BaseModel):
    """Estatísticas individuais e totais de um time."""

    player_stats: Dict[str, PlayerBoxScore] = Field(default_factory=dict)
    totals: PlayerBoxScore = Field(default_factory=PlayerBoxScore)


class ActionLog(BaseModel):
    """Descreve uma ação atômica dentro de uma posse de bola."""

    type: str  # "dispute", "move", "pass", "shoot", "rebound", "foul", "turnover", "shot_clock_violation"
    player: Optional[str] = None
    target_player: Optional[str] = None
    from_pos: Optional[Tuple[int, int]] = None
    to_pos: Optional[Tuple[int, int]] = None
    direction: Optional[str] = None
    duration_s: float = 0.0
    shot_type: Optional[str] = None  # "2pt", "3pt", "ft"
    result: Optional[str] = (
        None  # "made", "missed", "success", "intercepted", "stripped", "foul", "expired"
    )
    points: int = 0


class PossessionLog(BaseModel):
    """Agrupa as ações, duração e resultado de uma posse."""

    possession_id: int
    team: str
    actions: List[ActionLog] = Field(default_factory=list)
    outcome: str
    points: int = 0
    duration_s: float = 0.0


class QuarterLog(BaseModel):
    """Reúne as posses e o placar observado ao fim de um quarto."""

    quarter: int
    possessions: List[PossessionLog] = Field(default_factory=list)
    score_home: int = 0
    score_away: int = 0


class KeyMoment(BaseModel):
    """Representa um evento destacado para narração ou replay."""

    quarter: int
    time_remaining_s: float
    description: str
    score: str


class FinalScore(BaseModel):
    """Placar final separado entre mandante e visitante."""

    home: int
    away: int


class MatchLog(BaseModel):
    """Registro completo de uma partida simulada."""

    match_id: str
    home_team: str
    away_team: str
    winner: str
    final_score: FinalScore
    quarters: List[QuarterLog] = Field(default_factory=list)
    box_score: Dict[str, TeamBoxScore] = Field(default_factory=dict)
    key_moments: List[KeyMoment] = Field(default_factory=list)


class BallTrajectory(BaseModel):
    """Describe a pass or shot path for a single transition."""

    type: str  # "pass" | "shot"
    from_position: Optional[Tuple[int, int]] = None
    to_position: Optional[Tuple[int, int]] = None
    from_player_id: Optional[str] = None
    to_player_id: Optional[str] = None


class PlayerPosition(BaseModel):
    """One on-court player position inside a simulation frame."""

    player_id: str
    x: int
    y: int


class BallState(BaseModel):
    """Ball position and optional trajectory for one frame."""

    x: int
    y: int
    trajectory: Optional[BallTrajectory] = None


class ScoreSnapshot(BaseModel):
    """Score of both teams at one point in the simulation."""

    home: int
    away: int


class SimulationFrame(BaseModel):
    """One dense snapshot of the court after a single transition."""

    iteration: int
    player_with_ball_id: Optional[str]
    players: List[PlayerPosition] = Field(default_factory=list)
    ball: BallState
    score: ScoreSnapshot
    possession_team_id: Optional[str]


class SimulationEvent(BaseModel):
    """One ordered semantic event tied to a frame iteration."""

    sequence: int
    iteration: int
    type: str
    team_id: Optional[str] = None
    player_id: Optional[str] = None
    target_player_id: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class TransitionResult(BaseModel):
    """The observable effect of exactly one resolved game action."""

    action_type: str
    outcome: str
    player_id: Optional[str] = None
    target_player_id: Optional[str] = None
    acting_team_id: Optional[str] = None
    possession_team_id: Optional[str] = None
    turnover: bool = False
    scored: bool = False
    points: int = 0
    shot_value: Optional[int] = None
    is_three: bool = False
    possession_changed: bool = False
    score_home: int = 0
    score_away: int = 0
    trajectory: Optional[BallTrajectory] = None


class EngineSimulationResult(BaseModel):
    """The bounded, frame-based result of a single match simulation."""

    frames: List[SimulationFrame] = Field(default_factory=list)
    events: List[SimulationEvent] = Field(default_factory=list)
    iterations_completed: int = 0
    overtime_iterations: int = 0
    home_score: int = 0
    away_score: int = 0
    winner_team_id: str = ""
    termination_reason: str = ""
    engine_version: str = "1.0.0"
