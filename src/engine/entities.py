"""Runtime entity models and state tracking for an active basketball simulation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import random

from src.data_ingestion.schemas import Player, PlayerAttributes, Team
from src.engine.clock import GameClock
from src.engine.grid import CourtPosition, get_initial_center_positions
from src.engine.schemas import PlayerBoxScore


@dataclass
class LivePlayer:
    player_id: str
    name: str
    team_id: str
    position: str
    position5: str
    is_starter: bool
    attributes: PlayerAttributes
    current_stamina: float
    court_pos: CourtPosition = field(default_factory=lambda: CourtPosition(0, 0))
    fouls: int = 0
    fouled_out: bool = False
    is_on_court: bool = False
    box_score: PlayerBoxScore = field(default_factory=PlayerBoxScore)

    @classmethod
    def from_player(cls, player: Player) -> LivePlayer:
        return cls(
            player_id=player.player_id,
            name=player.name,
            team_id=player.team_id,
            position=player.position,
            position5=player.position5,
            is_starter=player.is_starter,
            attributes=player.attributes,
            current_stamina=player.attributes.stamina,
        )

    def record_minutes(self, duration_s: float) -> None:
        self.box_score.seconds_played += duration_s
        # Fatigue decay: roughly 0.0005 per second on court
        self.current_stamina = max(0.20, self.current_stamina - 0.0005 * duration_s)


@dataclass
class LiveTeam:
    team_id: str
    name: str
    abbreviation: str
    players: Dict[str, LivePlayer]
    on_court: List[str]  # 5 player_ids currently on court
    bench: List[str]     # remaining player_ids
    score: int = 0
    quarter_fouls: int = 0

    @classmethod
    def from_team_and_players(cls, team: Team, player_models: list[Player]) -> LiveTeam:
        team_players = [p for p in player_models if p.team_id == team.team_id]
        live_players = {p.player_id: LivePlayer.from_player(p) for p in team_players}

        # Select 5 starters
        starters = [p.player_id for p in team_players if p.is_starter][:5]
        # Fallback if fewer than 5 flagged starters
        if len(starters) < 5:
            remaining = [p.player_id for p in team_players if p.player_id not in starters]
            starters.extend(remaining[: 5 - len(starters)])

        bench = [pid for pid in team.roster if pid not in starters and pid in live_players]

        for pid in starters:
            live_players[pid].is_on_court = True

        return cls(
            team_id=team.team_id,
            name=team.name,
            abbreviation=team.abbreviation,
            players=live_players,
            on_court=starters,
            bench=bench,
        )

    def get_player(self, player_id: str) -> LivePlayer:
        return self.players[player_id]

    def get_on_court_players(self) -> list[LivePlayer]:
        return [self.players[pid] for pid in self.on_court]

    def reset_quarter_fouls(self) -> None:
        self.quarter_fouls = 0

    def select_ball_handler(self, rng: random.Random) -> str:
        """Weighted selection of active on-court players based on usage_rate."""
        active = self.get_on_court_players()
        weights = [max(0.01, p.attributes.usage_rate) for p in active]
        chosen = rng.choices(active, weights=weights, k=1)[0]
        return chosen.player_id

    def setup_court_positions(self, is_team_a: bool) -> None:
        """Places the 5 active players in the initial center court positions."""
        initial_coords = get_initial_center_positions(is_team_a)
        for i, pid in enumerate(self.on_court[:5]):
            if i < len(initial_coords):
                self.players[pid].court_pos = initial_coords[i]


@dataclass
class GameState:
    home_team: LiveTeam
    away_team: LiveTeam
    clock: GameClock = field(default_factory=GameClock)
    possession_team_id: str = ""
    defending_team_id: str = ""
    active_handler_id: str = ""
    possession_count: int = 0
    last_passer_id: Optional[str] = None  # to credit potential assists

    @property
    def attacking_team(self) -> LiveTeam:
        return self.home_team if self.possession_team_id == self.home_team.team_id else self.away_team

    @property
    def defending_team(self) -> LiveTeam:
        return self.away_team if self.possession_team_id == self.home_team.team_id else self.home_team

    def is_attacking_team_home(self) -> bool:
        return self.possession_team_id == self.home_team.team_id

    def flip_possession(self, new_handler_id: Optional[str] = None, rng: Optional[random.Random] = None) -> None:
        """Flips offense and defense, resetting shot clock and assigning ball handler."""
        prev_attacking = self.possession_team_id
        self.possession_team_id = self.defending_team_id
        self.defending_team_id = prev_attacking
        self.last_passer_id = None
        self.clock.reset_for_new_possession(is_offensive_rebound=False)

        if new_handler_id:
            self.active_handler_id = new_handler_id
        elif rng:
            self.active_handler_id = self.attacking_team.select_ball_handler(rng)

    def tick_players_on_court(self, duration_s: float) -> None:
        """Ticks playing time for all 10 players on the court."""
        for p in self.home_team.get_on_court_players():
            p.record_minutes(duration_s)
        for p in self.away_team.get_on_court_players():
            p.record_minutes(duration_s)
