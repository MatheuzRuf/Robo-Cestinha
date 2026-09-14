"""Heuristic resolution of possession actions and state machine edge probabilities.

Phase 1 implementation:
- Deterministic random sampling guided by real player statistics (shooting %,
  turnover rates, steal rates, rebound rates, usage, clutch, and fatigue).
- Hooks in place for Phase 2 spatial distance and geometric spacing adjustments.
"""

from __future__ import annotations

import random
from typing import Tuple

from src.engine.entities import GameState, LivePlayer, LiveTeam
from src.engine.grid import CourtPosition, Direction, is_three_pointer


def decide_handler_action(state: GameState, rng: random.Random) -> str:
    """Decides between PASS, MOVE, or SHOOT.

    As shot clock winds down, shot probability rises steeply.
    """
    shot_clock = state.clock.shot_clock_remaining

    if shot_clock <= 2.0:
        return "SHOOT"

    # Under 7 seconds, shooting urgency increases
    if shot_clock <= 7.0:
        urgency = (7.0 - shot_clock) / 7.0
        p_shoot = 0.35 + 0.55 * urgency
    else:
        p_shoot = 0.22

    remaining_prob = 1.0 - p_shoot
    p_pass = remaining_prob * 0.52
    p_move = remaining_prob * 0.48

    choice = rng.choices(["SHOOT", "PASS", "MOVE"], weights=[p_shoot, p_pass, p_move], k=1)[0]
    return choice


def resolve_pass_teammate(
    attacking_team: LiveTeam, current_handler_id: str, rng: random.Random
) -> LivePlayer:
    """Selects one of the other 4 teammates on court."""
    teammates = [p for p in attacking_team.get_on_court_players() if p.player_id != current_handler_id]
    weights = [max(0.05, p.attributes.usage_rate) for p in teammates]
    return rng.choices(teammates, weights=weights, k=1)[0]


def resolve_pass_outcome(
    passer: LivePlayer,
    receiver: LivePlayer,
    defending_team: LiveTeam,
    rng: random.Random,
) -> Tuple[bool, LivePlayer | None]:
    """Returns (success, intercepting_defender_or_none)."""
    avg_steal = sum(p.attributes.steal_rate for p in defending_team.get_on_court_players()) / 5.0
    p_turnover = min(0.35, max(0.04, passer.attributes.turnover_rate * 0.7 + avg_steal * 1.5))

    if rng.random() < p_turnover:
        # Intercepted
        defenders = defending_team.get_on_court_players()
        steal_weights = [max(0.01, d.attributes.steal_rate) for d in defenders]
        stealer = rng.choices(defenders, weights=steal_weights, k=1)[0]
        return False, stealer

    return True, None


def decide_move_direction(
    handler_pos: CourtPosition, is_team_a: bool, rng: random.Random
) -> Direction:
    """Selects 1 of the 8 directions or IDLE.

    Slightly biases movement toward the opponent's rim (Phase 1 court awareness).
    """
    directions = [
        Direction.N, Direction.NE, Direction.E, Direction.SE,
        Direction.S, Direction.SW, Direction.W, Direction.NW,
        Direction.IDLE,
    ]

    # Weights: Team A attacks toward X=9 (East); Team B attacks toward X=0 (West)
    if is_team_a:
        # Favor NE, E, SE
        weights = [1.0, 2.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.5, 1.2]
    else:
        # Favor NW, W, SW
        weights = [1.0, 0.5, 0.2, 0.5, 1.0, 2.0, 3.0, 2.0, 1.2]

    return rng.choices(directions, weights=weights, k=1)[0]


def resolve_move_outcome(
    handler: LivePlayer, defending_team: LiveTeam, direction: Direction, rng: random.Random
) -> Tuple[str, LivePlayer | None]:
    """Resolves MOVE action: 'SUCCESS', 'STRIPPED', 'FOUL_DRAWN', or 'HOLDS_BALL'."""
    if direction == Direction.IDLE:
        # Idle options: holds ball (80%), stripped (10%), foul drawn (10%)
        roll = rng.random()
        if roll < 0.10:
            defenders = defending_team.get_on_court_players()
            weights = [max(0.01, d.attributes.foul_rate) for d in defenders]
            fouler = rng.choices(defenders, weights=weights, k=1)[0]
            return "FOUL_DRAWN", fouler
        elif roll < 0.18:
            defenders = defending_team.get_on_court_players()
            weights = [max(0.01, d.attributes.steal_rate) for d in defenders]
            stealer = rng.choices(defenders, weights=weights, k=1)[0]
            return "STRIPPED", stealer
        else:
            return "HOLDS_BALL", None

    # Active directional movement: risk of turnover
    avg_steal = sum(p.attributes.steal_rate for p in defending_team.get_on_court_players()) / 5.0
    p_strip = min(0.25, max(0.03, handler.attributes.turnover_rate * 0.5 + avg_steal))
    if rng.random() < p_strip:
        defenders = defending_team.get_on_court_players()
        weights = [max(0.01, d.attributes.steal_rate) for d in defenders]
        stealer = rng.choices(defenders, weights=weights, k=1)[0]
        return "STRIPPED", stealer

    return "SUCCESS", None


def resolve_shot(
    shooter: LivePlayer,
    is_team_a: bool,
    game_state: GameState,
    rng: random.Random,
) -> Tuple[bool, bool, int]:
    """Resolves a shot attempt.

    Returns:
        (is_made, is_three_pt, points_awarded)
    """
    is_three = is_three_pointer(shooter.court_pos, is_team_a)
    points = 3 if is_three else 2

    # Base shooting percentage
    base_pct = shooter.attributes.three_pt_pct if is_three else shooter.attributes.two_pt_pct

    # Fatigue modifier: below 0.4 stamina degrades up to 10%
    if shooter.current_stamina < 0.40:
        stamina_penalty = (0.40 - shooter.current_stamina) * 0.25
        base_pct = max(0.15, base_pct - stamina_penalty)

    # Clutch modifier: quarter 4/OT with score margin <= 5
    score_diff = abs(game_state.home_team.score - game_state.away_team.score)
    if game_state.clock.quarter >= 4 and score_diff <= 5:
        clutch_bonus = (shooter.attributes.clutch_factor - 0.5) * 0.12
        base_pct = min(0.95, max(0.10, base_pct + clutch_bonus))

    is_made = rng.random() < base_pct
    return is_made, is_three, (points if is_made else 0)


def resolve_rebound(
    game_state: GameState, rng: random.Random
) -> Tuple[LivePlayer, bool]:
    """All 10 on-court players dispute the rebound.

    Returns:
        (rebounder, is_offensive)
    """
    off_players = game_state.attacking_team.get_on_court_players()
    def_players = game_state.defending_team.get_on_court_players()

    # Offensive rebound rates from data; defense gets standard advantage (~75% league norm)
    off_weights = [max(0.02, p.attributes.rebound_rate * 1.0) for p in off_players]
    def_weights = [max(0.05, (0.15 + (1.0 - p.attributes.rebound_rate * 0.5)) * 1.8) for p in def_players]

    all_players = off_players + def_players
    all_weights = off_weights + def_weights

    rebounder = rng.choices(all_players, weights=all_weights, k=1)[0]
    is_offensive = (rebounder.team_id == game_state.attacking_team.team_id)
    return rebounder, is_offensive
