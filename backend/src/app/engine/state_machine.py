"""Máquina de estados que conduz cada posse de bola."""

from __future__ import annotations

import random

from app.engine.entities import GameState
from app.engine.grid import get_target_rim
from app.engine.heuristics import (
    decide_handler_action,
    decide_move_direction,
    resolve_move_outcome,
    resolve_pass_outcome,
    resolve_pass_teammate,
    resolve_shot,
)
from app.engine.movement import reposition_players
from app.engine.schemas import (
    ActionLog,
    BallTrajectory,
    PossessionLog,
    TransitionResult,
)


class StateMachine:
    """Converte decisões heurísticas em ações e mudanças de estado."""

    def __init__(self, rng: random.Random):
        """Cria a máquina usando o gerador aleatório compartilhado."""
        self.rng = rng

    def resolve_possession(self, state: GameState) -> PossessionLog:
        """Executa uma posse até cesta, perda, violação ou fim do quarto."""
        possession_id = state.possession_count
        team = state.possession_team_id
        actions = []
        points = 0
        outcome = "continue"

        # A posse começa com um condutor; passes podem trocar esse jogador.
        if not state.active_handler_id:
            state.active_handler_id = state.attacking_team.select_ball_handler(self.rng)

        # Ações curtas consomem o relógio até produzirem um resultado final.
        while outcome == "continue":
            handler = state.attacking_team.get_player(state.active_handler_id)
            action_type = decide_handler_action(state, self.rng)
            action_log = ActionLog(type=action_type, player=handler.player_id)

            if action_type == "PASS":
                receiver = resolve_pass_teammate(
                    state.attacking_team, handler.player_id, self.rng
                )
                success, stealer = resolve_pass_outcome(
                    handler, receiver, state.defending_team, self.rng
                )

                action_log.target_player = receiver.player_id
                action_log.duration_s = 1.5

                if success:
                    action_log.result = "success"
                    state.active_handler_id = receiver.player_id
                    state.last_passer_id = handler.player_id
                else:
                    # A interceptação encerra a posse e inverte o ataque.
                    action_log.result = "intercepted"
                    action_log.player = stealer.player_id
                    outcome = "turnover"
                    state.flip_possession(new_handler_id=stealer.player_id)

            elif action_type == "MOVE":
                direction = decide_move_direction(state, handler, self.rng)
                outcome_type, intercepter = resolve_move_outcome(
                    handler, state.defending_team, direction, self.rng
                )

                action_log.direction = direction.value
                action_log.duration_s = 2.0

                if outcome_type == "SUCCESS":
                    action_log.result = "success"
                    handler.court_pos = handler.court_pos.move(direction)
                elif outcome_type == "STRIPPED":
                    action_log.result = "stripped"
                    action_log.player = intercepter.player_id
                    outcome = "turnover"
                    state.flip_possession(new_handler_id=intercepter.player_id)
                else:
                    # Falta sofrida e retenção não encerram a posse nesta fase.
                    action_log.result = outcome_type
                    # Simple handling: clock keeps ticking, possession continues

            elif action_type == "SHOOT":
                is_made, is_three, pts = resolve_shot(
                    handler, state.is_attacking_team_home(), state, self.rng
                )
                action_log.shot_type = "3pt" if is_three else "2pt"
                action_log.result = "made" if is_made else "missed"
                action_log.points = pts
                points = pts

                if is_made:
                    outcome = "made"
                    if state.is_attacking_team_home():
                        state.home_team.score += pts
                    else:
                        state.away_team.score += pts
                    state.flip_possession(rng=self.rng)
                else:
                    outcome = "missed"
                    # O rebote ainda é simplificado: por enquanto a posse troca.
                    state.flip_possession(rng=self.rng)

            # O relógio pode encerrar a posse mesmo depois da ação escolhida.
            elapsed, violation = state.clock.tick(action_log.duration_s)
            action_log.duration_s = elapsed

            if violation:
                action_log.type = "shot_clock_violation"
                outcome = "turnover"
                state.flip_possession(rng=self.rng)

            reposition_players(state, self.rng)
            actions.append(action_log)
            if state.clock.is_quarter_ended():
                outcome = "quarter_end"

        return PossessionLog(
            possession_id=possession_id,
            team=team,
            actions=actions,
            outcome=outcome,
            points=points,
            duration_s=sum(a.duration_s for a in actions),
        )

    def resolve_next_transition(self, state: GameState) -> TransitionResult:
        """Resolve exactly one atomic action and return its observable result.

        Unlike :meth:`resolve_possession`, this runs a single PASS, MOVE, or
        SHOOT action and returns, so a caller can capture one frame per
        transition.

        Args:
            state: Shared game state to resolve and mutate.

        Returns:
            The resolved transition, including the effect on the score and
            possession.
        """

        if not state.active_handler_id:
            state.active_handler_id = state.attacking_team.select_ball_handler(self.rng)

        handler = state.attacking_team.get_player(state.active_handler_id)
        acting_team_id = state.possession_team_id
        action_type = decide_handler_action(state, self.rng)
        outcome = "continue"
        points = 0
        shot_value = None
        is_three = False
        target_player_id = None
        trajectory = None
        duration_s = 2.0
        possession_intact = True

        if action_type == "PASS":
            receiver = resolve_pass_teammate(
                state.attacking_team, handler.player_id, self.rng
            )
            success, stealer = resolve_pass_outcome(
                handler, receiver, state.defending_team, self.rng
            )
            duration_s = 1.5
            target_player_id = receiver.player_id
            trajectory = BallTrajectory(
                type="pass",
                from_position=handler.court_pos.to_tuple(),
                to_position=receiver.court_pos.to_tuple(),
                from_player_id=handler.player_id,
                to_player_id=receiver.player_id,
            )
            if success:
                state.active_handler_id = receiver.player_id
                state.last_passer_id = handler.player_id
                outcome = "success"
            else:
                state.flip_possession(new_handler_id=stealer.player_id)
                outcome = "turnover"
                possession_intact = False
        elif action_type == "MOVE":
            direction = decide_move_direction(state, handler, self.rng)
            outcome_type, intercepter = resolve_move_outcome(
                handler, state.defending_team, direction, self.rng
            )
            duration_s = 2.0
            if outcome_type == "SUCCESS":
                handler.court_pos = handler.court_pos.move(direction)
                outcome = "success"
            elif outcome_type == "STRIPPED":
                state.flip_possession(new_handler_id=intercepter.player_id)
                outcome = "turnover"
                possession_intact = False
            elif outcome_type == "FOUL_DRAWN":
                outcome = "foul"
            else:
                outcome = "holds"
        elif action_type == "SHOOT":
            is_made, is_three, pts = resolve_shot(
                handler, state.is_attacking_team_home(), state, self.rng
            )
            duration_s = 1.2
            shot_value = 3 if is_three else 2
            points = pts
            outcome = "made" if is_made else "missed"
            rim = get_target_rim(state.is_attacking_team_home())
            trajectory = BallTrajectory(
                type="shot",
                from_position=handler.court_pos.to_tuple(),
                to_position=rim,
                from_player_id=handler.player_id,
                to_player_id=None,
            )
            if is_made:
                if state.is_attacking_team_home():
                    state.home_team.score += pts
                else:
                    state.away_team.score += pts
            state.flip_possession(rng=self.rng)
            possession_intact = False

        _, violation = state.clock.tick(duration_s)
        if violation and possession_intact:
            state.flip_possession(rng=self.rng)
            outcome = "turnover"

        reposition_players(state, self.rng)

        return TransitionResult(
            action_type=action_type.lower(),
            outcome=outcome,
            player_id=handler.player_id,
            target_player_id=target_player_id,
            acting_team_id=acting_team_id,
            possession_team_id=state.possession_team_id,
            turnover=outcome == "turnover",
            scored=outcome == "made",
            points=points,
            shot_value=shot_value,
            is_three=is_three,
            possession_changed=state.possession_team_id != acting_team_id,
            score_home=state.home_team.score,
            score_away=state.away_team.score,
            trajectory=trajectory,
        )
