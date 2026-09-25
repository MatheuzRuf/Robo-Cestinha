"""Heurísticas que resolvem ações e probabilidades de uma posse.

Nesta fase, o sorteio usa uma instância de ``random.Random`` com estatísticas
dos jogadores. A grade espacial já fornece pontos de extensão para regras de
distância e espaçamento mais detalhadas.
"""

from __future__ import annotations

import random
from typing import Tuple

from app.engine.entities import GameState, LivePlayer, LiveTeam
from app.engine.grid import CourtPosition, Direction, is_three_pointer


def decide_handler_action(state: GameState, rng: random.Random) -> str:
    """Escolhe entre ``PASS``, ``MOVE`` e ``SHOOT``.

    Quanto menor o relógio de posse, maior a urgência para arremessar.
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

    choice = rng.choices(
        ["SHOOT", "PASS", "MOVE"], weights=[p_shoot, p_pass, p_move], k=1
    )[0]
    return choice


def resolve_pass_teammate(
    attacking_team: LiveTeam, current_handler_id: str, rng: random.Random
) -> LivePlayer:
    """Escolhe um dos quatro companheiros em quadra, ponderando uso."""
    teammates = [
        p
        for p in attacking_team.get_on_court_players()
        if p.player_id != current_handler_id
    ]
    weights = [max(0.05, p.attributes.usage_rate) for p in teammates]
    return rng.choices(teammates, weights=weights, k=1)[0]


def resolve_pass_outcome(
    passer: LivePlayer,
    receiver: LivePlayer,
    defending_team: LiveTeam,
    rng: random.Random,
) -> Tuple[bool, LivePlayer | None]:
    """Resolve o passe e retorna sucesso ou o defensor que interceptou."""
    avg_steal = (
        sum(p.attributes.steal_rate for p in defending_team.get_on_court_players())
        / 5.0
    )
    p_turnover = min(
        0.35, max(0.04, passer.attributes.turnover_rate * 0.7 + avg_steal * 1.5)
    )

    if rng.random() < p_turnover:
        # Em uma falha, o defensor é sorteado pela taxa de roubos.
        defenders = defending_team.get_on_court_players()
        steal_weights = [max(0.01, d.attributes.steal_rate) for d in defenders]
        stealer = rng.choices(defenders, weights=steal_weights, k=1)[0]
        return False, stealer

    return True, None


def decide_move_direction(
    handler_pos: CourtPosition, is_team_a: bool, rng: random.Random
) -> Direction:
    """Escolhe uma das oito direções ou ``IDLE``.

    O peso maior aponta para a cesta adversária.
    """
    directions = [
        Direction.N,
        Direction.NE,
        Direction.E,
        Direction.SE,
        Direction.S,
        Direction.SW,
        Direction.W,
        Direction.NW,
        Direction.IDLE,
    ]

    # O time A avança para X=9; o time B avança para X=0.
    if is_team_a:
        # Favor NE, E, SE
        weights = [1.0, 2.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.5, 1.2]
    else:
        # Favor NW, W, SW
        weights = [1.0, 0.5, 0.2, 0.5, 1.0, 2.0, 3.0, 2.0, 1.2]

    return rng.choices(directions, weights=weights, k=1)[0]


def resolve_move_outcome(
    handler: LivePlayer,
    defending_team: LiveTeam,
    direction: Direction,
    rng: random.Random,
) -> Tuple[str, LivePlayer | None]:
    """Resolve o movimento: ``SUCCESS``, ``STRIPPED``, ``FOUL_DRAWN`` ou ``HOLDS_BALL``."""
    if direction == Direction.IDLE:
        # Parado, o jogador pode sofrer falta, ser desarmado ou manter a bola.
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

    # Um movimento ativo também pode terminar em perda de bola.
    avg_steal = (
        sum(p.attributes.steal_rate for p in defending_team.get_on_court_players())
        / 5.0
    )
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
    """Resolve um arremesso aplicando distância, fadiga e clutch.

    Retorna ``(convertido, e_de_tres, pontos_conquistados)``.
    """
    is_three = is_three_pointer(shooter.court_pos, is_team_a)
    points = 3 if is_three else 2

    # A distância define se usamos o aproveitamento de dois ou três pontos.
    base_pct = (
        shooter.attributes.three_pt_pct if is_three else shooter.attributes.two_pt_pct
    )

    # A fadiga abaixo de 0,4 reduz gradualmente a chance de conversão.
    if shooter.current_stamina < 0.40:
        stamina_penalty = (0.40 - shooter.current_stamina) * 0.25
        base_pct = max(0.15, base_pct - stamina_penalty)

    # Em momentos decisivos, o atributo de clutch ajusta a probabilidade.
    score_diff = abs(game_state.home_team.score - game_state.away_team.score)
    if game_state.clock.quarter >= 4 and score_diff <= 5:
        clutch_bonus = (shooter.attributes.clutch_factor - 0.5) * 0.12
        base_pct = min(0.95, max(0.10, base_pct + clutch_bonus))

    is_made = rng.random() < base_pct
    return is_made, is_three, (points if is_made else 0)


def resolve_rebound(
    game_state: GameState, rng: random.Random
) -> Tuple[LivePlayer, bool]:
    """Sorteia o rebote entre os dez jogadores em quadra.

    Retorna ``(rebotador, e_rebote_ofensivo)``.
    """
    off_players = game_state.attacking_team.get_on_court_players()
    def_players = game_state.defending_team.get_on_court_players()

    # O peso defensivo inclui a vantagem média de rebote da defesa.
    off_weights = [max(0.02, p.attributes.rebound_rate * 1.0) for p in off_players]
    def_weights = [
        max(0.05, (0.15 + (1.0 - p.attributes.rebound_rate * 0.5)) * 1.8)
        for p in def_players
    ]

    all_players = off_players + def_players
    all_weights = off_weights + def_weights

    rebounder = rng.choices(all_players, weights=all_weights, k=1)[0]
    is_offensive = rebounder.team_id == game_state.attacking_team.team_id
    return rebounder, is_offensive
