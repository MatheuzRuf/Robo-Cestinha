"""Orquestração de alto nível de uma partida completa."""

from __future__ import annotations

import random
from app.engine.entities import GameState, LiveTeam
from app.engine.state_machine import StateMachine
from app.engine.schemas import MatchLog, QuarterLog, FinalScore


class MatchRunner:
    """Prepara o estado e executa os quatro quartos da partida."""

    def __init__(self, home_team: LiveTeam, away_team: LiveTeam, seed: int = 42):
        """Inicializa times, posições e aleatoriedade determinística."""
        self.state = GameState(home_team, away_team)
        self.rng = random.Random(seed)
        self.fsm = StateMachine(self.rng)

        # Initialize
        self.state.possession_team_id = home_team.team_id
        self.state.defending_team_id = away_team.team_id
        home_team.setup_court_positions(is_team_a=True)
        away_team.setup_court_positions(is_team_a=False)

    def run_match(self) -> MatchLog:
        """Executa os quartos e retorna o log estruturado da partida."""
        quarters = []

        for q in range(1, 5):
            quarter_log = QuarterLog(quarter=q)

            while not self.state.clock.is_quarter_ended():
                possession = self.fsm.resolve_possession(self.state)
                quarter_log.possessions.append(possession)
                self.state.possession_count += 1

                    # Toda posse também atualiza o tempo em quadra e a fadiga.
                self.state.tick_players_on_court(possession.duration_s)

            quarter_log.score_home = self.state.home_team.score
            quarter_log.score_away = self.state.away_team.score
            quarters.append(quarter_log)

            # Entre quartos, reiniciamos tempo e faltas coletivas.
            if q < 4:
                self.state.clock.start_next_period(is_overtime=False)
                self.state.home_team.reset_quarter_fouls()
                self.state.away_team.reset_quarter_fouls()

        return MatchLog(
            match_id=f"{self.state.home_team.team_id}_vs_{self.state.away_team.team_id}",
            home_team=self.state.home_team.team_id,
            away_team=self.state.away_team.team_id,
            winner=self.state.home_team.team_id
            if self.state.home_team.score > self.state.away_team.score
            else self.state.away_team.team_id,
            final_score=FinalScore(
                home=self.state.home_team.score, away=self.state.away_team.score
            ),
            quarters=quarters,
        )
