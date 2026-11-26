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


def _offensive_target(
    player: LivePlayer, handler: LivePlayer, attack_direction: int
) -> CourtPosition:
    """Retorna o alvo de espaçamento ofensivo para um jogador sem a bola."""
    role = player.position5
    hx = handler.court_pos.x
    if attack_direction == 1:  # atacando à direita
        if role in ("PF", "C"):
            target_x = min(8, max(hx + 2, 7))
        elif role in ("SG", "SF"):
            target_x = min(8, max(hx + 1, 6))
        else:  # PG sem a bola, topo do garrafão
            target_x = min(7, max(hx, 6))
    else:  # atacando à esquerda
        if role in ("PF", "C"):
            target_x = max(1, min(hx - 2, 2))
        elif role in ("SG", "SF"):
            target_x = max(1, min(hx - 1, 3))
        else:
            target_x = max(2, min(hx, 3))

    if role in ("PF", "C"):
        y = 2
    elif role in ("SG", "SF"):
        y = 4 if player.court_pos.y >= 2 else 0
    else:
        y = 2
    return CourtPosition(target_x, y)


def reposition_players(state: GameState, rng: random.Random) -> None:
    """Advance players one legal step toward spacing and defensive targets.

    Compromisso ofensivo: o condutor não se move; os demais sobem para o
    meio-campo (alas, garrafão e topo) e os defensores ficam entre seu
    marcado e a cesta defendida.
    """
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
        if player.player_id == handler.player_id:
            continue
        depth = ROLE_DEPTHS.get(player.position5, DEPTH_ORDER[index])
        frontcourt_target = _offensive_target(player, handler, attack_direction)
        # Avanço para o meio-campo com perfil de profundidade/função preservado.
        if attack_direction == 1:
            target_x = max(
                handler.court_pos.x + attack_direction * depth, frontcourt_target.x
            )
        else:
            target_x = min(
                handler.court_pos.x + attack_direction * depth, frontcourt_target.x
            )
        targets[player.player_id] = CourtPosition(target_x, lane)

    defenders_sorted = sorted(defense, key=lambda player: player.position5)
    attackers_sorted = sorted(offense, key=lambda player: player.position5)
    for defender, attacker in zip(defenders_sorted, attackers_sorted):
        if attack_direction == 1:
            target_x = min(attacker.court_pos.x + attack_direction, 8)
            if attacker.court_pos.x == 9:
                target_x = 8
        else:
            target_x = max(attacker.court_pos.x + attack_direction, 1)
            if attacker.court_pos.x == 0:
                target_x = 1
        targets[defender.player_id] = CourtPosition(target_x, attacker.court_pos.y)

    # Proteção da pintura: puxa o C (e PF, se longe) para perto da cesta quando
    # a bola entra no meio-campo.
    if (attack_direction == 1 and handler.court_pos.x >= 4) or (
        attack_direction == -1 and handler.court_pos.x <= 5
    ):
        for defender in defenders_sorted:
            role = defender.position5
            backup_x = 8 if attack_direction == 1 else 1
            if role == "C" or (
                role == "PF" and defender.court_pos.distance_to((backup_x, 2)) > 4.0
            ):
                targets[defender.player_id] = CourtPosition(backup_x, 2)

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
