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
