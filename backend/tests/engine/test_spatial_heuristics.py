"""Spatial-realism tests for the engine's stealing, interception, shooting and
rebounding heuristics.

These guard the hard spatial bounds locked by the implementation plan:
- On-ball steals/fouls only happen within ``ON_BALL_STEAL_MAX_DIST`` cells.
- Pass interceptions require a defender within ``PASS_INTERCEPT_MAX_DIST`` cells
  of the passing lane, and only lane defenders can be credited.
- Normal shots are gated to ``MAX_NORMAL_SHOT_RANGE_FT`` unless it is a
  shot-clock buzzer-beater.
- Rebounds are grabbed within ``REBOUND_MAX_CELLS`` of the attacked rim and
  honour ``rebound_rate`` in the *positive* direction (regression guard for the
  inverted defensive formula).
"""

from __future__ import annotations

import math
import random

from app.data_ingestion.schemas import Player, PlayerAttributes, Team, TeamStats
from app.engine.entities import GameState, LivePlayer, LiveTeam
from app.engine.grid import (
    ON_BALL_STEAL_MAX_DIST,
    PASS_INTERCEPT_MAX_DIST,
    REBOUND_MAX_CELLS,
    CourtPosition,
    Direction,
    distance_to_hoop_ft,
    is_three_pointer,
    point_to_segment_distance,
)
from app.engine.heuristics import (
    decide_handler_action,
    resolve_move_outcome,
    resolve_pass_outcome,
    resolve_rebound,
    resolve_shot,
)
from app.engine.match_runner import MatchRunner


def _attributes(**overrides) -> PlayerAttributes:
    base = {
        "two_pt_pct": 0.5,
        "three_pt_pct": 0.35,
        "ft_pct": 0.8,
        "turnover_rate": 0.2,
        "foul_rate": 0.05,
        "rebound_rate": 0.05,
        "assist_rate": 0.3,
        "steal_rate": 0.02,
        "block_rate": 0.1,
        "stamina": 0.8,
        "clutch_factor": 0.5,
        "usage_rate": 0.2,
    }
    base.update(overrides)
    return PlayerAttributes(**base)


def _player(player_id, team_id, attrs: PlayerAttributes | None = None, pos5="PG"):
    return Player(
        player_id=player_id,
        team_id=team_id,
        name=player_id,
        position="G",
        position5=pos5,
        is_starter=True,
        attributes=attrs or _attributes(),
    )


def _team(team_id, roster: list[Player]) -> LiveTeam:
    team = Team(
        team_id=team_id,
        name=team_id.capitalize(),
        abbreviation=team_id[:3].upper(),
        roster=[p.player_id for p in roster],
        team_stats=TeamStats(pace=1.0, off_rtg=100.0, def_rtg=100.0),
        season="2025",
    )
    return LiveTeam.from_team_and_players(team, roster)


def _make_teams(
    off_attrs=None, def_attrs_list=None, off_positions=None, def_positions=None
):
    """Build an attacking (``home``) and defending (``away``) team.

    ``def_attrs_list`` lets each of the five defenders carry a custom attribute
    set; defaults mirror the offensive side.
    """
    home_roster = [
        _player(f"h{i}", "home", off_attrs or _attributes()) for i in range(5)
    ]
    if off_positions:
        for p, pos in zip(home_roster, off_positions):
            p.position5 = pos
    if def_attrs_list is None:
        def_attrs_list = [off_attrs or _attributes() for _ in range(5)]
    away_roster = [_player(f"a{i}", "away", def_attrs_list[i]) for i in range(5)]
    if def_positions:
        for p, pos in zip(away_roster, def_positions):
            p.position5 = pos
    return _team("home", home_roster), _team("away", away_roster)


def _state(home: LiveTeam, away: LiveTeam, possession="home") -> GameState:
    state = GameState(home_team=home, away_team=away)
    if possession == "home":
        state.possession_team_id = home.team_id
        state.defending_team_id = away.team_id
    else:
        state.possession_team_id = away.team_id
        state.defending_team_id = home.team_id
    state.active_handler_id = (
        home.on_court[0] if possession == "home" else away.on_court[0]
    )
    return state


def _place(team: LiveTeam, coords: list[tuple[int, int]]) -> None:
    team.place_on_court([CourtPosition(x, y) for x, y in coords])


def _handler(team: LiveTeam) -> LivePlayer:
    return team.get_player(team.on_court[0])


def _realistic_runner(seed: int = 7) -> MatchRunner:
    """Build a MatchRunner with a realistic mixed-position roster."""
    positions = ["PG", "SG", "SF", "PF", "C"]
    attr_sets = [
        {
            "three_pt_pct": 0.38,
            "two_pt_pct": 0.50,
            "rebound_rate": 0.03,
            "steal_rate": 0.015,
        },
        {
            "three_pt_pct": 0.35,
            "two_pt_pct": 0.45,
            "rebound_rate": 0.04,
            "steal_rate": 0.014,
        },
        {
            "three_pt_pct": 0.33,
            "two_pt_pct": 0.47,
            "rebound_rate": 0.05,
            "steal_rate": 0.012,
        },
        {
            "three_pt_pct": 0.32,
            "two_pt_pct": 0.52,
            "rebound_rate": 0.15,
            "steal_rate": 0.011,
        },
        {
            "three_pt_pct": 0.28,
            "two_pt_pct": 0.58,
            "rebound_rate": 0.20,
            "steal_rate": 0.010,
        },
    ]

    def build(team_id):
        roster = [
            _player(
                f"{team_id}{i}", team_id, _attributes(**attr_sets[i]), pos5=positions[i]
            )
            for i in range(5)
        ]
        team = Team(
            team_id=team_id,
            name=team_id.capitalize(),
            abbreviation=team_id[:3].upper(),
            roster=[p.player_id for p in roster],
            team_stats=TeamStats(pace=100.0, off_rtg=112.0, def_rtg=110.0),
            season="2025",
        )
        return LiveTeam.from_team_and_players(team, roster)

    return MatchRunner(build("home"), build("away"), seed=seed)


# --- Phase 1: on-ball steals & fouls ------------------------------------------


def test_on_ball_steal_impossible_when_no_defender_nearby():
    home, away = _make_teams(
        def_attrs_list=[_attributes(steal_rate=0.07, foul_rate=0.05) for _ in range(5)]
    )
    _place(home, [(4, 2), (4, 3), (4, 1), (5, 1), (3, 3)])
    # Every defender >= 2.5 cells from the handler at (4,2).
    _place(away, [(0, 0), (0, 4), (9, 0), (9, 4), (0, 2)])
    handler = _handler(home)
    assert (
        min(
            d.court_pos.distance_to(handler.court_pos)
            for d in away.get_on_court_players()
        )
        >= 2.5
    )

    for direction_e in (Direction.N, Direction.IDLE):
        outcomes = {
            resolve_move_outcome(handler, away, direction_e, random.Random(s))[0]
            for s in range(200)
        }
        assert "STRIPPED" not in outcomes
        assert "FOUL_DRAWN" not in outcomes


def test_on_ball_steal_always_credits_adjacent_defender():
    home, away = _make_teams(
        def_attrs_list=[_attributes(steal_rate=0.07, foul_rate=0.05) for _ in range(5)]
    )
    _place(home, [(4, 2), (4, 3), (4, 1), (5, 1), (3, 3)])
    # One defender directly adjacent (distance 1.0), the rest far away.
    _place(away, [(4, 3), (0, 0), (0, 4), (9, 0), (9, 4)])
    handler = _handler(home)
    adjacent = away.players["a0"]
    assert any(
        abs(d.court_pos.distance_to(handler.court_pos) - 1.0) < 1e-9
        for d in away.get_on_court_players()
    )

    creditors = set()
    for s in range(200):
        _, who = resolve_move_outcome(handler, away, Direction.N, random.Random(s))
        if who is not None:
            creditors.add(who.player_id)
        _, who = resolve_move_outcome(handler, away, Direction.IDLE, random.Random(s))
        if who is not None:
            creditors.add(who.player_id)
    assert creditors  # at least some strips/fouls triggered
    assert creditors <= {adjacent.player_id}


def test_pass_interception_requires_defender_near_passing_lane():
    home, away = _make_teams()
    # Handler at (1,2), receiver at (6,2): long horizontal lane.
    _place(home, [(1, 2), (6, 2), (4, 4), (4, 0), (4, 2)])
    # All defenders far from the lane (y=0/4 corners, x far from segment).
    _place(away, [(0, 0), (0, 4), (9, 0), (9, 4), (4, 4)])
    passer = home.players["h0"]
    receiver = home.players["h1"]
    assert all(
        point_to_segment_distance(d.court_pos, passer.court_pos, receiver.court_pos)
        > PASS_INTERCEPT_MAX_DIST
        for d in away.get_on_court_players()
    )
    for s in range(200):
        success, _ = resolve_pass_outcome(passer, receiver, away, random.Random(s))
        assert success is True


def test_pass_interception_credits_only_lane_defender():
    home, away = _make_teams()
    _place(home, [(1, 2), (6, 2), (4, 4), (4, 0), (4, 2)])
    # Defender a0 sits exactly on the lane; the rest are far.
    _place(away, [(4, 2), (0, 0), (0, 4), (9, 0), (9, 4)])
    passer = home.players["h0"]
    receiver = home.players["h1"]
    lane = away.players["a0"]
    assert (
        point_to_segment_distance(lane.court_pos, passer.court_pos, receiver.court_pos)
        < 1e-9
    )

    interceptors = set()
    for s in range(300):
        _, stealer = resolve_pass_outcome(passer, receiver, away, random.Random(s))
        if stealer is not None:
            interceptors.add(stealer.player_id)
    assert interceptors
    assert interceptors <= {lane.player_id}


# --- Phase 2: shot selection & accuracy ---------------------------------------


def test_no_non_buzzer_shots_from_backcourt():
    home, away = _make_teams()
    # Handler in the backcourt attacking right => very far from right hoop.
    _place(home, [(1, 2), (4, 2), (4, 4), (4, 0), (3, 3)])
    _place(away, [(6, 2), (6, 3), (6, 1), (7, 3), (7, 1)])
    state = _state(home, away)
    handler = _handler(home)
    assert distance_to_hoop_ft(handler.court_pos, True) > 31.0

    actions = [decide_handler_action(state, random.Random(s)) for s in range(1000)]
    assert "SHOOT" not in actions

    # Buzzer-beater forces a heave regardless of distance.
    state.clock.shot_clock_remaining = 1.5
    assert all(
        decide_handler_action(state, random.Random(s)) == "SHOOT" for s in range(50)
    )


def test_deep_heaves_have_low_make_rate():
    home, away = _make_teams(off_attrs=_attributes(three_pt_pct=0.4, two_pt_pct=0.55))
    _place(home, [(1, 2), (4, 2), (4, 4), (4, 0), (3, 3)])
    _place(away, [(6, 2), (6, 3), (6, 1), (7, 3), (7, 1)])
    state = _state(home, away)
    shooter = _handler(home)
    assert distance_to_hoop_ft(shooter.court_pos, True) > 60.0

    made = sum(
        resolve_shot(shooter, True, state, random.Random(s))[0] for s in range(500)
    )
    assert made / 500.0 < 0.12


def test_is_three_pointer_matches_rendered_arc_including_corners():
    # Home attacks right (rim at 88.75, 25 ft).
    assert not is_three_pointer(CourtPosition(8, 2), True)  # paint / block
    assert not is_three_pointer(CourtPosition(7, 2), True)  # midrange
    assert not is_three_pointer(CourtPosition(7, 1), True)  # elbow
    assert is_three_pointer(CourtPosition(8, 0), True)  # corner
    assert is_three_pointer(CourtPosition(9, 4), True)  # opposite corner
    assert is_three_pointer(CourtPosition(6, 2), True)  # top of key
    assert is_three_pointer(CourtPosition(6, 1), True)  # wing
    # Away attacks left (rim at 5.25, 25 ft) -> mirror.
    assert not is_three_pointer(CourtPosition(1, 2), False)
    assert not is_three_pointer(CourtPosition(2, 2), False)
    assert not is_three_pointer(CourtPosition(2, 1), False)
    assert is_three_pointer(CourtPosition(1, 0), False)
    assert is_three_pointer(CourtPosition(0, 4), False)
    assert is_three_pointer(CourtPosition(3, 2), False)


# --- Phase 2: rebounding ------------------------------------------------------


def test_rebound_always_goes_to_rim_proximity_player():
    home, away = _make_teams()
    # Two players near the attacked rim; the other 8 far away.
    state = _state(home, away)
    _place(home, [(8, 2), (8, 1), (0, 4), (0, 0), (3, 4)])
    _place(away, [(7, 2), (0, 4), (5, 4), (5, 0), (3, 0)])
    near = {"h0", "h1", "a0"}
    for _ in range(200):
        rebounder, _ = resolve_rebound(state, random.Random(_))
        assert rebounder.player_id in near


def test_rebound_respects_rebound_rate_direction():
    home, away = _make_teams()
    state = _state(home, away)
    # All ten within rebound zone of rim B (home attacks right).
    _place(home, [(8, 2), (8, 1), (8, 3), (7, 2), (7, 3)])
    _place(away, [(8, 2), (8, 1), (8, 3), (7, 2), (7, 3)])
    # Make away defender a0 a dominant rebounder.
    away.players["a0"].attributes.rebound_rate = 0.30
    away.players["a1"].attributes.rebound_rate = 0.02

    wins_a0 = wins_a1 = 0
    for s in range(2000):
        rebounder, _ = resolve_rebound(state, random.Random(s))
        if rebounder.player_id == "a0":
            wins_a0 += 1
        elif rebounder.player_id == "a1":
            wins_a1 += 1
    assert wins_a0 > wins_a1 * 4


# --- Phase 1/2: full simulation event & trajectory alignment ------------------


def test_intercepted_pass_trajectory_targets_stealer():
    result = _realistic_runner(seed=11).run_simulation(400)
    frames = {f.iteration: f for f in result.frames}
    intercepts = [e for e in result.events if e.type == "pass_intercepted"]
    assert intercepts, "no interceptions observed"
    for event in intercepts:
        it = event.iteration
        frame = frames[it]
        traj = frame.ball.trajectory
        assert traj is not None
        # Trajectory must point at the interceptor, not the intended receiver.
        assert traj.to_player_id == event.target_player_id
        assert traj.to_player_id is not None
        # to_position matches the stealer's pre-transition cell.
        if it - 1 >= 0:
            prev = {p.player_id: (p.x, p.y) for p in frames[it - 1].players}
            assert traj.to_position == prev[traj.to_player_id]


def test_full_simulation_spatial_distributions():
    result = _realistic_runner(seed=7).run_simulation(1000)
    pos = [None] * len(result.frames)
    for idx, frame in enumerate(result.frames):
        pos[idx] = {p.player_id: (p.x, p.y) for p in frame.players}

    home_id = result.frames[0].possession_team_id
    # Lane proximity for interceptions is guaranteed by the dedicated unit
    # tests (test_pass_interception_requires_defender_near_passing_lane and
    # test_pass_interception_credits_only_lane_defender); here we only assert
    # the on-ball steal/rebound/shot spatial bounds plus the scoring mix.
    intercept_iters = {
        e.iteration for e in result.events if e.type == "pass_intercepted"
    }

    steal_dists = []
    shot_dists = []
    reb_dists = []
    two = three = 0
    dreb = oreb = 0

    for e in result.events:
        it = e.iteration
        if it <= 0:
            continue
        pp = pos[it - 1]
        if e.type == "shot_attempted":
            x, y = pp[e.player_id]
            is_a = e.team_id == home_id
            shot_dists.append(distance_to_hoop_ft(CourtPosition(x, y), is_a))
            if e.data["shotValue"] == 2:
                two += 1
            else:
                three += 1
        elif e.type == "rebound":
            x, y = pp[e.player_id]
            reb_dists.append(min(math.hypot(x - 9, y - 2), math.hypot(x - 0, y - 2)))
            if e.data["reboundType"] == "offensive":
                oreb += 1
            else:
                dreb += 1
        elif e.type == "turnover" and it not in intercept_iters:
            # On-ball strip: handler -> stealer guard distance.
            pid, did = e.player_id, e.target_player_id
            if pid in pp and did in pp:
                hx, hy = pp[pid]
                dx, dy = pp[did]
                steal_dists.append(math.hypot(hx - dx, hy - dy))

    assert all(d <= ON_BALL_STEAL_MAX_DIST for d in steal_dists), steal_dists
    assert len(shot_dists) >= 30
    assert sum(1 for d in shot_dists if d <= 31.0) >= 0.95 * len(shot_dists)
    assert 0.40 <= two / (two + three) <= 0.75
    assert len(reb_dists) >= 5
    assert sum(1 for d in reb_dists if d <= REBOUND_MAX_CELLS) >= 0.95 * len(reb_dists)
    assert oreb >= 1 and dreb >= 1


def test_on_court_rebounder_within_max_cells():
    home, away = _make_teams()
    state = _state(home, away)
    _place(home, [(8, 2), (8, 1), (8, 3), (7, 2), (7, 3)])
    _place(away, [(8, 2), (8, 1), (8, 3), (7, 2), (7, 3)])
    for s in range(300):
        rebounder, _ = resolve_rebound(state, random.Random(s))
        # Attacked rim is RIM_B (9,2) for home.
        assert rebounder.court_pos.distance_to((9, 2)) <= REBOUND_MAX_CELLS
