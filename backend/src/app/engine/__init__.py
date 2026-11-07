"""API pública dos principais componentes do simulador de partidas."""

from app.engine.schemas import (
    EngineSimulationResult,
    MatchLog,
    SimulationEvent,
    SimulationFrame,
    TransitionResult,
)
from app.engine.entities import GameState, LiveTeam, LivePlayer
from app.engine.state_machine import StateMachine
from app.engine.match_runner import MatchRunner

__all__ = [
    "MatchLog",
    "EngineSimulationResult",
    "SimulationEvent",
    "SimulationFrame",
    "TransitionResult",
    "GameState",
    "LiveTeam",
    "LivePlayer",
    "StateMachine",
    "MatchRunner",
]
