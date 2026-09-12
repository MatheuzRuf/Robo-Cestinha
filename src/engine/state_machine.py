"""State machine orchestrator for the possession loop.
"""

from __future__ import annotations

import random
from src.engine.entities import GameState
from src.engine.heuristics import (
    decide_handler_action,
    resolve_pass_teammate,
    resolve_pass_outcome,
    decide_move_direction,
    resolve_move_outcome,
    resolve_shot,
)
from src.engine.schemas import ActionLog, PossessionLog


class StateMachine:
    def __init__(self, rng: random.Random):
        self.rng = rng

    def resolve_possession(self, state: GameState) -> PossessionLog:
        """Runs the possession loop until a basket, turnover, or violation."""
        possession_id = state.possession_count
        team = state.possession_team_id
        actions = []
        points = 0
        outcome = "continue"

        # Initialize handler
        if not state.active_handler_id:
            state.active_handler_id = state.attacking_team.select_ball_handler(self.rng)

        # Loop until possession ends
        while outcome == "continue":
            handler = state.attacking_team.get_player(state.active_handler_id)
            action_type = decide_handler_action(state, self.rng)
            action_log = ActionLog(type=action_type, player=handler.player_id)

            if action_type == "PASS":
                receiver = resolve_pass_teammate(state.attacking_team, handler.player_id, self.rng)
                success, stealer = resolve_pass_outcome(handler, receiver, state.defending_team, self.rng)
                
                action_log.target_player = receiver.player_id
                action_log.duration_s = 1.5
                
                if success:
                    action_log.result = "success"
                    state.active_handler_id = receiver.player_id
                    state.last_passer_id = handler.player_id
                else:
                    action_log.result = "intercepted"
                    action_log.player = stealer.player_id
                    outcome = "turnover"
                    state.flip_possession(new_handler_id=stealer.player_id)
            
            elif action_type == "MOVE":
                direction = decide_move_direction(handler.court_pos, state.is_attacking_team_home(), self.rng)
                outcome_type, intercepter = resolve_move_outcome(handler, state.defending_team, direction, self.rng)
                
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
                    # Foul or hold
                    action_log.result = outcome_type
                    # Simple handling: clock keeps ticking, possession continues
                    
            elif action_type == "SHOOT":
                is_made, is_three, pts = resolve_shot(handler, state.is_attacking_team_home(), state, self.rng)
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
                    # Rebound logic would go here, simplified to flip
                    state.flip_possession(rng=self.rng)

            # Advance clock
            elapsed, violation = state.clock.tick(action_log.duration_s)
            action_log.duration_s = elapsed
            
            if violation:
                action_log.type = "shot_clock_violation"
                outcome = "turnover"
                state.flip_possession(rng=self.rng)
            
            actions.append(action_log)
            if state.clock.is_quarter_ended():
                outcome = "quarter_end"

        return PossessionLog(
            possession_id=possession_id,
            team=team,
            actions=actions,
            outcome=outcome,
            points=points,
            duration_s=sum(a.duration_s for a in actions)
        )
