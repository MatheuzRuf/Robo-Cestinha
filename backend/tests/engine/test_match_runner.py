from app.data_ingestion.schemas import Player, PlayerAttributes, Team, TeamStats
from app.engine.entities import LiveTeam
from app.engine.match_runner import MatchRunner


def _attributes():
    return PlayerAttributes(
        two_pt_pct=0.5,
        three_pt_pct=0.38,
        ft_pct=0.8,
        turnover_rate=0.2,
        foul_rate=0.1,
        rebound_rate=0.2,
        assist_rate=0.3,
        steal_rate=0.1,
        block_rate=0.1,
        stamina=0.7,
        clutch_factor=0.5,
        usage_rate=0.3,
    )


def _player(player_id, team_id):
    return Player(
        player_id=player_id,
        team_id=team_id,
        name=player_id,
        position="G",
        position5="PG",
        is_starter=True,
        attributes=_attributes(),
    )


def _team(team_id, roster):
    return Team(
        team_id=team_id,
        name=team_id.capitalize(),
        abbreviation=team_id[:3].upper(),
        roster=roster,
        team_stats=TeamStats(pace=1.0, off_rtg=100.0, def_rtg=100.0),
        season="2025",
    )


def _make_runner(seed=7):
    home_roster = [f"h{i}" for i in range(5)]
    away_roster = [f"a{i}" for i in range(5)]
    home = _team("home", home_roster)
    away = _team("away", away_roster)
    players = [_player(p, "home") for p in home_roster] + [
        _player(p, "away") for p in away_roster
    ]
    home_team = LiveTeam.from_team_and_players(home, players)
    away_team = LiveTeam.from_team_and_players(away, players)
    return MatchRunner(home_team, away_team, seed=seed)


def test_frame_count_is_initial_plus_one_per_transition():
    result = _make_runner(seed=7).run_simulation(50)
    assert len(result.frames) == result.iterations_completed + 1
    assert result.iterations_completed >= 50


def test_frames_are_monotonic_and_start_at_zero():
    result = _make_runner(seed=7).run_simulation(20)
    iterations = [frame.iteration for frame in result.frames]
    assert iterations == list(range(result.iterations_completed + 1))
    assert result.frames[0].player_with_ball_id is not None


def test_every_frame_has_all_ten_players_and_one_ball_owner():
    result = _make_runner(seed=7).run_simulation(30)
    assert len(result.events) >= 2
    for frame in result.frames:
        assert len(frame.players) == 10
        player_ids = {p.player_id for p in frame.players}
        assert len(player_ids) == 10
        assert frame.player_with_ball_id in player_ids


def test_off_ball_players_reposition_with_varied_directions():
    result = _make_runner(seed=7).run_simulation(50)
    moved_players = set()
    varied_transition = False

    for previous, current in zip(result.frames, result.frames[1:]):
        before = {player.player_id: (player.x, player.y) for player in previous.players}
        after = {player.player_id: (player.x, player.y) for player in current.players}
        deltas = [
            (after[player_id][0] - x, after[player_id][1] - y)
            for player_id, (x, y) in before.items()
            if after[player_id] != (x, y)
        ]
        assert all(abs(dx) <= 1 and abs(dy) <= 1 for dx, dy in deltas)
        moved_players.update(
            player_id
            for player_id, (x, y) in before.items()
            if after[player_id] != (x, y)
        )
        varied_transition |= len(deltas) > 1 and len(set(deltas)) > 1

    assert len(moved_players) == 10
    assert varied_transition
    assert all(
        len({(player.x, player.y) for player in frame.players}) == 10
        for frame in result.frames
    )


def test_scores_are_monotonic_and_never_decrease():
    result = _make_runner(seed=7).run_simulation(40)
    home_low = 0
    away_low = 0
    for frame in result.frames:
        assert frame.score.home >= home_low
        assert frame.score.away >= away_low
        home_low = frame.score.home
        away_low = frame.score.away


def test_events_have_unique_sequence_and_valid_iteration():
    result = _make_runner(seed=7).run_simulation(30)
    sequences = [event.sequence for event in result.events]
    assert sequences == sorted(sequences)
    assert len(set(sequences)) == len(sequences)
    max_iteration = result.iterations_completed
    for event in result.events:
        assert 0 <= event.iteration <= max_iteration


def test_shot_events_carry_required_payload():
    result = _make_runner(seed=7).run_simulation(100)
    attempted = {e.type: e for e in result.events}.get("shot_attempted")
    made = [e for e in result.events if e.type == "shot_made"]
    if attempted is not None:
        assert "shotValue" in attempted.data
    for event in made:
        assert "pointsScored" in event.data
        assert "scoreAfter" in event.data


def test_any_result_always_has_a_winner():
    for seed in range(1, 20):
        for iterations in (5, 30):
            result = _make_runner(seed=seed).run_simulation(iterations)
            assert result.home_score != result.away_score
            assert result.winner_team_id in ("home", "away")
            assert result.iterations_completed >= iterations


def test_overtime_resolves_a_tied_match_with_extra_frames():
    for seed in range(1, 60):
        result = _make_runner(seed=seed).run_simulation(1)
        if result.termination_reason == "overtime_score":
            assert result.overtime_iterations >= 1
            assert len(result.frames) == result.iterations_completed + 1
            assert result.home_score != result.away_score
            return
    raise AssertionError("No seed produced an overtime tie; overtime path untested")


def test_simulation_is_deterministic_for_a_seed():
    first = _make_runner(seed=11).run_simulation(40)
    second = _make_runner(seed=11).run_simulation(40)
    assert first == second
