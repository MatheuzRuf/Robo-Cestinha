"""Coordinated off-ball movement for the five-on-five court simulation."""

from __future__ import annotations

import random
from collections import deque

from app.engine.entities import GameState, LivePlayer
from app.engine.grid import DIRECTION_VECTORS, GRID_HEIGHT, GRID_WIDTH, CourtPosition

ROLE_LANES = {"PG": 2, "SG": 4, "SF": 0, "PF": 3, "C": 1}
ROLE_DEPTHS = {"PG": 0, "SG": 1, "SF": 1, "PF": 2, "C": 2}
LANE_ORDER = (2, 4, 0, 3, 1)
DEPTH_ORDER = (0, 1, 1, 2, 2)


def reposition_players(state: GameState, rng: random.Random) -> None:
    """Advance players one legal step toward spacing and defensive targets."""
    offense = state.attacking_team.get_on_court_players()
    defense = state.defending_team.get_on_court_players()
    handler = state.attacking_team.get_player(state.active_handler_id)
    attack_direction = 1 if state.is_attacking_team_home() else -1
    targets = {handler.player_id: handler.court_pos}
    used_lanes = set()

    for index, player in enumerate(offense):
        lane = max(
            0,
            min(
                4,
                ROLE_LANES.get(player.position5, LANE_ORDER[index])
                + handler.court_pos.y
                - 2,
            ),
        )
        if lane in used_lanes:
            lane = next(y for y in LANE_ORDER if y not in used_lanes)
        used_lanes.add(lane)
        if player.player_id != handler.player_id:
            depth = ROLE_DEPTHS.get(player.position5, DEPTH_ORDER[index])
            targets[player.player_id] = CourtPosition(
                handler.court_pos.x + attack_direction * depth, lane
            )

    for defender, attacker in zip(
        sorted(defense, key=lambda player: player.position5),
        sorted(offense, key=lambda player: player.position5),
    ):
        targets[defender.player_id] = CourtPosition(
            attacker.court_pos.x + attack_direction, attacker.court_pos.y
        )

    players = offense + defense
    for player in rng.sample(players, len(players)):
        _step_toward(player, targets[player.player_id], players, rng)


def _step_toward(
    player: LivePlayer,
    target: CourtPosition,
    players: list[LivePlayer],
    rng: random.Random,
) -> None:
    current = player.court_pos
    occupied = {other.court_pos for other in players if other is not player}
    free = [
        CourtPosition(x, y)
        for x in range(GRID_WIDTH)
        for y in range(GRID_HEIGHT)
        if CourtPosition(x, y) not in occupied
    ]
    distance = min(position.distance_to(target) for position in free)
    goals = [position for position in free if position.distance_to(target) == distance]
    if current in goals:
        return
    goal = rng.choice(goals)

    queue = deque([current])
    visited = {current}
    first_steps = {}

    while queue:
        position = queue.popleft()
        for dx, dy in DIRECTION_VECTORS.values():
            candidate = CourtPosition(position.x + dx, position.y + dy)
            if candidate == position or candidate in occupied or candidate in visited:
                continue
            visited.add(candidate)
            first_steps[candidate] = (
                candidate if position == current else first_steps[position]
            )
            if candidate == goal:
                player.court_pos = first_steps[candidate]
                return
            queue.append(candidate)
