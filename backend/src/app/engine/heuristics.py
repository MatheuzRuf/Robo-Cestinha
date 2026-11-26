"""Heurísticas que resolvem ações e probabilidades de uma posse.

Nesta fase, o sorteio usa uma instância de ``random.Random`` com estatísticas
dos jogadores. A grade espacial já fornece pontos de extensão para regras de
distância e espaçamento mais detalhadas.
"""

from __future__ import annotations

import random

from app.engine.entities import GameState, LivePlayer, LiveTeam
from app.engine.grid import (
    DIRECTION_VECTORS,
    MAX_NORMAL_SHOT_RANGE_FT,
    ON_BALL_STEAL_MAX_DIST,
    PASS_INTERCEPT_MAX_DIST,
    REBOUND_MAX_CELLS,
    THREE_POINT_RADIUS_FT,
    CourtPosition,
    Direction,
    distance_to_hoop_ft,
    get_target_rim,
    is_three_pointer,
    point_to_segment_distance,
)


def decide_handler_action(state: GameState, rng: random.Random) -> str:
    """Escolhe entre ``PASS``, ``MOVE`` e ``SHOOT`` respeitando a distância à cesta.

    Arremessos normais só acontecem até ``MAX_NORMAL_SHOT_RANGE_FT``; além disso
    só há ``SHOOT`` no estouro do relógio (``shot_clock <= 2.0``, arremesso de
    desespero).
    """
    shot_clock = state.clock.shot_clock_remaining

    if shot_clock <= 2.0:
        return "SHOOT"

    handler = state.attacking_team.get_player(state.active_handler_id)
    dist_ft = distance_to_hoop_ft(handler.court_pos, state.is_attacking_team_home())

    if dist_ft > MAX_NORMAL_SHOT_RANGE_FT:
        # Fora do alcance normal de arremesso: nada de meia-quadra.
        return rng.choices(["MOVE", "PASS"], weights=[0.65, 0.35], k=1)[0]

    # Base shoot probability by distance zone.
    if dist_ft <= 14.0:
        base_shoot = 0.58  # paint
    elif dist_ft < THREE_POINT_RADIUS_FT:
        base_shoot = 0.40  # midrange
    else:
        base_shoot = max(
            0.14, min(0.38, (handler.attributes.three_pt_pct - 0.15) * 1.15)
        )

    # Shot-clock urgency pushes shooting up toward 0.90 inside 7 seconds.
    if shot_clock <= 7.0:
        urgency = (7.0 - shot_clock) / 7.0
        base_shoot = min(0.92, base_shoot + (0.90 - base_shoot) * urgency)

    p_shoot = base_shoot
    remaining = 1.0 - p_shoot
    if dist_ft <= 14.0:
        p_pass = remaining * 0.75
        p_move = remaining * 0.25
    else:
        p_pass = remaining * 0.50
        p_move = remaining * 0.50

    return rng.choices(
        ["SHOOT", "PASS", "MOVE"], weights=[p_shoot, p_pass, p_move], k=1
    )[0]


def resolve_pass_teammate(
    attacking_team: LiveTeam,
    current_handler_id: str,
    rng: random.Random,
    attacking_team_is_a: bool | None = None,
) -> LivePlayer:
    """Escolhe um dos quatro companheiros em quadra, ponderando uso e progressão.

    Quando ``attacking_team_is_a`` é informado, a escolha privilegia passes para
    frente (avanço) no fundo de quadra e mantém arremessos dentro do alcance
    normal no meio-campo.
    """
    handler = attacking_team.get_player(current_handler_id)
    teammates = [
        p
        for p in attacking_team.get_on_court_players()
        if p.player_id != current_handler_id
    ]
    weights = [max(0.05, p.attributes.usage_rate) for p in teammates]

    if attacking_team_is_a is not None:
        handler_dist = distance_to_hoop_ft(handler.court_pos, attacking_team_is_a)
        for i, mate in enumerate(teammates):
            teammate_dist = distance_to_hoop_ft(mate.court_pos, attacking_team_is_a)
            if handler_dist > 30.0:
                # Backcourt / transition: reward outlet passes, punish backward.
                if teammate_dist < handler_dist - 4.0:
                    weights[i] *= 3.0
                elif teammate_dist > handler_dist + 4.0:
                    weights[i] *= 0.35
            else:
                # Half-court: keep shots in range, avoid launching from 36+ ft.
                if teammate_dist <= MAX_NORMAL_SHOT_RANGE_FT:
                    weights[i] *= 1.3
                elif teammate_dist > 36.0:
                    weights[i] *= 0.4
    return rng.choices(teammates, weights=weights, k=1)[0]


def resolve_pass_outcome(
    passer: LivePlayer,
    receiver: LivePlayer,
    defending_team: LiveTeam,
    rng: random.Random,
    safety_boost: float = 0.0,
) -> tuple[bool, LivePlayer | None]:
    """Resolve o passe e retorna sucesso ou o defensor que interceptou.

    Args:
        safety_boost: Reduz a chance de interceptação; usada na reposição para
            garantir no mínimo ~95% de sucesso (erro com piso de 5%).
    """
    # Somente defensores perto do corredor do passe podem interceptar.
    lane_defenders = [
        (
            d,
            point_to_segment_distance(
                d.court_pos, passer.court_pos, receiver.court_pos
            ),
        )
        for d in defending_team.get_on_court_players()
        if point_to_segment_distance(d.court_pos, passer.court_pos, receiver.court_pos)
        <= PASS_INTERCEPT_MAX_DIST
    ]
    if not lane_defenders:
        return True, None

    lane_pressure = sum(
        d.attributes.steal_rate / (0.5 + dist) for d, dist in lane_defenders
    )
    pass_dist = passer.court_pos.distance_to(receiver.court_pos)
    len_factor = 1.0 + max(0.0, pass_dist - 2.0) * 0.12
    p_turnover = min(
        0.32,
        max(
            0.03,
            (passer.attributes.turnover_rate * 0.45 + lane_pressure * 1.1) * len_factor,
        ),
    )
    if safety_boost:
        p_turnover = min(0.05, p_turnover * (1.0 - min(1.0, safety_boost)))

    if rng.random() < p_turnover:
        # Interceptor escolhido estritamente entre os defensores do corredor.
        steal_weights = [
            max(0.005, d.attributes.steal_rate) / (0.5 + dist)
            for d, dist in lane_defenders
        ]
        stealer = rng.choices(
            [d for d, _ in lane_defenders], weights=steal_weights, k=1
        )[0]
        return False, stealer

    return True, None


def resolve_inbound_receiver(attacking_team: LiveTeam, inbounder_id: str) -> LivePlayer:
    """Escolhe o recebedor da reposição: o companheiro em quadra mais próximo
    do repositor, desempatando por menor ``usage_rate`` e depois pela ordem no
    quinteto (mantém o passe curto e legível)."""
    inbounder = attacking_team.get_player(inbounder_id)
    order = attacking_team.on_court
    teammates = [
        p for p in attacking_team.get_on_court_players() if p.player_id != inbounder_id
    ]

    def key(player: LivePlayer) -> tuple[float, float, int]:
        return (
            inbounder.court_pos.distance_to(player.court_pos),
            player.attributes.usage_rate,
            order.index(player.player_id),
        )

    return min(teammates, key=key)


def decide_move_direction(
    state: GameState, handler: LivePlayer, rng: random.Random
) -> Direction:
    """Choose a dribble step that reduces distance to the attacking rim."""
    rim = get_target_rim(state.is_attacking_team_home())
    distance = handler.court_pos.distance_to(rim)
    occupied = {
        player.court_pos
        for team in (state.home_team, state.away_team)
        for player in team.get_on_court_players()
        if player.player_id != handler.player_id
    }
    options = [
        direction
        for direction, (dx, dy) in DIRECTION_VECTORS.items()
        if direction != Direction.IDLE
        and CourtPosition(handler.court_pos.x + dx, handler.court_pos.y + dy)
        not in occupied
        and CourtPosition(
            handler.court_pos.x + dx, handler.court_pos.y + dy
        ).distance_to(rim)
        < distance
    ]
    return rng.choice(options) if options else Direction.IDLE


def _prox(dist: float) -> float:
    """Proximidade de marcação: máxima quando colado, reduzida além de 1.05."""
    return 1.0 if dist <= 1.05 else 0.65


def resolve_move_outcome(
    handler: LivePlayer,
    defending_team: LiveTeam,
    direction: Direction,
    rng: random.Random,
) -> tuple[str, LivePlayer | None]:
    """Resolve o movimento: ``SUCCESS``, ``STRIPPED``, ``FOUL_DRAWN`` ou
    ``HOLDS_BALL``.

    Roubos e faltas só podem ocorrer quando há um defensor a menos de
    ``ON_BALL_STEAL_MAX_DIST`` células do condutor.
    """
    nearby = [
        (d, d.court_pos.distance_to(handler.court_pos))
        for d in defending_team.get_on_court_players()
        if d.court_pos.distance_to(handler.court_pos) <= ON_BALL_STEAL_MAX_DIST
    ]
    if not nearby:
        # Sem marcação próxima: a bola não é roubada nem falta sofrida.
        if direction == Direction.IDLE:
            return "HOLDS_BALL", None
        return "SUCCESS", None

    local_steal = sum(d.attributes.steal_rate * _prox(dist) for d, dist in nearby)

    if direction == Direction.IDLE:
        # Parado, o jogador pode sofrer falta, ser desarmado ou manter a bola.
        p_foul = 0.08
        p_strip = min(0.14, 0.03 + local_steal * 1.6)
        roll = rng.random()
        if roll < p_foul:
            fouler = rng.choices(
                [d for d, _ in nearby],
                weights=[
                    max(0.005, d.attributes.foul_rate) * _prox(dist)
                    for d, dist in nearby
                ],
                k=1,
            )[0]
            return "FOUL_DRAWN", fouler
        if roll < p_foul + p_strip:
            stealer = rng.choices(
                [d for d, _ in nearby],
                weights=[
                    max(0.005, d.attributes.steal_rate) * _prox(dist)
                    for d, dist in nearby
                ],
                k=1,
            )[0]
            return "STRIPPED", stealer
        return "HOLDS_BALL", None

    # Um movimento ativo também pode terminar em perda de bola.
    p_strip = min(
        0.22,
        max(0.02, handler.attributes.turnover_rate * 0.35 + local_steal * 1.5),
    )
    if rng.random() < p_strip:
        stealer = rng.choices(
            [d for d, _ in nearby],
            weights=[
                max(0.005, d.attributes.steal_rate) * _prox(dist) for d, dist in nearby
            ],
            k=1,
        )[0]
        return "STRIPPED", stealer

    return "SUCCESS", None


def resolve_shot(
    shooter: LivePlayer,
    is_team_a: bool,
    game_state: GameState,
    rng: random.Random,
) -> tuple[bool, bool, int]:
    """Resolve um arremesso aplicando distância, fadiga e clutch.

    Retorna ``(convertido, e_de_tres, pontos_conquistados)``.
    """
    is_three = is_three_pointer(shooter.court_pos, is_team_a)
    points = 3 if is_three else 2
    dist_ft = distance_to_hoop_ft(shooter.court_pos, is_team_a)

    # A distância define se usamos o aproveitamento de dois ou três pontos.
    base_pct = (
        shooter.attributes.three_pt_pct if is_three else shooter.attributes.two_pt_pct
    )

    # Bônus de finalização perto da cesta (pintura).
    if not is_three and dist_ft <= 10.0:
        base_pct = min(0.78, base_pct + 0.04)

    # Decaimento de distância para arremessos de desespero (heaves).
    if dist_ft > 30.0:
        heave_factor = max(0.12, 1.0 - (dist_ft - 30.0) / 22.0)
        base_pct = max(0.04, base_pct * heave_factor)

    # A fadiga abaixo de 0,4 reduz gradualmente a chance de conversão.
    if shooter.current_stamina < 0.40:
        stamina_penalty = (0.40 - shooter.current_stamina) * 0.25
        floor = 0.03 if dist_ft > 30.0 else 0.15
        base_pct = max(floor, base_pct - stamina_penalty)

    # Em momentos decisivos, o atributo de clutch ajusta a probabilidade.
    score_diff = abs(game_state.home_team.score - game_state.away_team.score)
    if game_state.clock.quarter >= 4 and score_diff <= 5:
        clutch_bonus = (shooter.attributes.clutch_factor - 0.5) * 0.12
        base_pct = min(0.95, max(0.10, base_pct + clutch_bonus))

    is_made = rng.random() < base_pct
    return is_made, is_three, (points if is_made else 0)


def resolve_rebound(
    game_state: GameState, rng: random.Random
) -> tuple[LivePlayer, bool]:
    """Sorteia o rebote entre os dez jogadores em quadra.

    Retorna ``(rebotador, e_rebote_ofensivo)``.
    """
    rim = get_target_rim(game_state.is_attacking_team_home())
    off_players = game_state.attacking_team.get_on_court_players()
    def_players = game_state.defending_team.get_on_court_players()

    candidates = [(p, True, p.court_pos.distance_to(rim)) for p in off_players] + [
        (p, False, p.court_pos.distance_to(rim)) for p in def_players
    ]

    eligible = [entry for entry in candidates if entry[2] <= REBOUND_MAX_CELLS]
    if not eligible:
        min_dist = min(entry[2] for entry in candidates)
        eligible = [entry for entry in candidates if entry[2] <= min_dist + 1.0]

    weights = []
    for player, is_offensive, dist in eligible:
        skill = 0.04 + player.attributes.rebound_rate
        side_mult = 1.0 if is_offensive else 2.4
        prox = 1.0 / (0.5 + dist**2.2)
        weights.append(max(0.001, skill * side_mult * prox))

    rebounder, is_offensive, _ = rng.choices(eligible, weights=weights, k=1)[0]
    return rebounder, is_offensive
