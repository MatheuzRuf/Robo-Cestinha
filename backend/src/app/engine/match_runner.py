"""Orquestração de alto nível de uma partida completa."""

from __future__ import annotations

import random
from app.engine.entities import GameState, LiveTeam
from app.engine.grid import GRID_HEIGHT, GRID_WIDTH, CourtPosition
from app.engine.state_machine import StateMachine
from app.engine.schemas import (
    BallState,
    EngineSimulationResult,
    FinalScore,
    MatchLog,
    PlayerPosition,
    QuarterLog,
    ScoreSnapshot,
    SimulationEvent,
    SimulationFrame,
    TransitionResult,
)


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
        self.state.active_handler_id = home_team.select_ball_handler(self.rng)
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

    def run_simulation(self, max_iterations: int) -> EngineSimulationResult:
        """Run a bounded, transition-based simulation and return its frames.

        Iterations is the sole end condition: exactly ``max_iterations``
        transitions run, then a tied score is resolved through overtime until
        one team scores. One frame is captured before the first transition and
        again after every transition.

        Args:
            max_iterations: Number of normal-play transitions to run.

        Returns:
            The ordered frames, events, and final score/winner.
        """

        frames: list[SimulationFrame] = []
        events: list[SimulationEvent] = []
        sequence = 0

        def capture(iteration: int) -> None:
            frames.append(self._capture_frame(iteration))

        def emit(
            iteration: int,
            event_type: str,
            team_id: str | None,
            player_id: str | None,
            target_player_id: str | None,
            data: dict,
        ) -> None:
            nonlocal sequence
            sequence += 1
            events.append(
                SimulationEvent(
                    sequence=sequence,
                    iteration=iteration,
                    type=event_type,
                    team_id=team_id,
                    player_id=player_id,
                    target_player_id=target_player_id,
                    data=data,
                )
            )

        capture(0)
        emit(0, "game_started", self.state.home_team.team_id, None, None, {})

        completed = 0
        overtime_iterations = 0
        for _ in range(max_iterations):
            self._refill_clock()
            transition = self.fsm.resolve_next_transition(self.state)
            completed += 1
            capture(completed)
            self._append_transition_events(transition, completed, emit)

        termination_reason = "iteration_limit"
        if self.state.home_team.score == self.state.away_team.score:
            termination_reason = "overtime_score"
            emit(completed, "overtime_started", None, None, None, {})
            while self.state.home_team.score == self.state.away_team.score:
                self._refill_clock()
                transition = self.fsm.resolve_next_transition(self.state)
                completed += 1
                overtime_iterations += 1
                capture(completed)
                self._append_transition_events(transition, completed, emit)

        winner_team_id = (
            self.state.home_team.team_id
            if self.state.home_team.score > self.state.away_team.score
            else self.state.away_team.team_id
        )
        emit(
            completed,
            "game_finished",
            winner_team_id,
            None,
            None,
            {"winnerTeamId": winner_team_id},
        )

        return EngineSimulationResult(
            frames=frames,
            events=events,
            iterations_completed=completed,
            overtime_iterations=overtime_iterations,
            home_score=self.state.home_team.score,
            away_score=self.state.away_team.score,
            winner_team_id=winner_team_id,
            termination_reason=termination_reason,
        )

    def _refill_clock(self) -> None:
        """Keep game time plentiful so only the shot clock drives turnovers."""
        if self.state.clock.game_clock_remaining < 60.0:
            self.state.clock.start_next_period(is_overtime=False)

    def _capture_frame(self, iteration: int) -> SimulationFrame:
        """Build a dense frame snapshot for the current game state."""
        state = self.state
        players: list[PlayerPosition] = []
        for team in (state.home_team, state.away_team):
            for player in team.get_on_court_players():
                players.append(
                    PlayerPosition(
                        player_id=player.player_id,
                        x=player.court_pos.x,
                        y=player.court_pos.y,
                    )
                )

        holder = state.active_handler_id
        if holder and holder in state.home_team.players:
            ball_position = state.home_team.get_player(holder).court_pos
        elif holder and holder in state.away_team.players:
            ball_position = state.away_team.get_player(holder).court_pos
        else:
            holder = None
            ball_position = CourtPosition(GRID_WIDTH // 2, GRID_HEIGHT // 2)

        return SimulationFrame(
            iteration=iteration,
            player_with_ball_id=holder,
            players=players,
            ball=BallState(x=ball_position.x, y=ball_position.y),
            score=ScoreSnapshot(home=state.home_team.score, away=state.away_team.score),
            possession_team_id=state.possession_team_id,
        )

    @staticmethod
    def _append_transition_events(
        transition: TransitionResult, iteration: int, emit
    ) -> None:
        """Emit semantic events for one resolved transition."""
        action_type = transition.action_type
        if transition.outcome == "turnover":
            emit(
                iteration,
                "turnover",
                transition.acting_team_id,
                transition.player_id,
                None,
                {},
            )
            if action_type == "pass":
                emit(
                    iteration,
                    "pass_intercepted",
                    transition.acting_team_id,
                    transition.player_id,
                    None,
                    {},
                )
            emit(
                iteration,
                "possession_changed",
                transition.possession_team_id,
                None,
                None,
                {"previousTeamId": transition.acting_team_id},
            )
            return

        if action_type == "pass":
            emit(
                iteration,
                "pass_completed",
                transition.acting_team_id,
                transition.player_id,
                transition.target_player_id,
                {},
            )
        elif action_type == "move" and transition.outcome == "foul":
            emit(
                iteration,
                "foul",
                transition.acting_team_id,
                transition.player_id,
                None,
                {},
            )
        elif action_type == "shoot":
            emit(
                iteration,
                "shot_attempted",
                transition.acting_team_id,
                transition.player_id,
                None,
                {"shotValue": transition.shot_value},
            )
            if transition.scored:
                emit(
                    iteration,
                    "shot_made",
                    transition.acting_team_id,
                    transition.player_id,
                    None,
                    {
                        "pointsScored": transition.points,
                        "scoreAfter": {
                            "home": transition.score_home,
                            "away": transition.score_away,
                        },
                    },
                )
            else:
                emit(
                    iteration,
                    "shot_missed",
                    transition.acting_team_id,
                    transition.player_id,
                    None,
                    {"shotValue": transition.shot_value},
                )
                emit(
                    iteration, "rebound", transition.possession_team_id, None, None, {}
                )
            emit(
                iteration,
                "possession_changed",
                transition.possession_team_id,
                None,
                None,
                {"previousTeamId": transition.acting_team_id},
            )
