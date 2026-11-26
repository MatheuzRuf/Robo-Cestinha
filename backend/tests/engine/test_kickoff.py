"""Testes da reorganização/kickoff pós-cesta e da reposição de bola."""

from app.data_ingestion.schemas import Player, PlayerAttributes, Team, TeamStats
from app.engine.entities import LiveTeam
from app.engine.grid import get_defensive_reset_positions, get_inbound_positions
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


def _score_kickoff_events(result):
    return [
        event
        for event in result.events
        if event.type == "kickoff" and event.data.get("reason") == "score"
    ]


def test_made_basket_triggers_kickoff_reset_then_inbound_pass():
    result = _make_runner(seed=7).run_simulation(400)

    events = _score_kickoff_events(result)
    assert events

    for event in events:
        index = event.iteration
        previous = result.frames[index - 1]
        reset = result.frames[index]
        inbound = result.frames[index + 1]

        # Frame anterior é um arremesso convertido (placar sobe naquela transição).
        assert previous.ball.trajectory is not None
        assert previous.ball.trajectory.type == "shot"
        before = result.frames[index - 2]
        assert (
            before.score.home + before.score.away
            < previous.score.home + previous.score.away
        )
        # A própria reposição não altera o placar.
        assert previous.score == reset.score

        # Primeira transição: formação + bola no repositor, sem trajetória.
        assert reset.phase == "kickoff"
        assert reset.ball.trajectory is None
        assert reset.player_with_ball_id is not None

        # Segunda transição: passe de fundo com trajetória ``inbound``.
        assert inbound.phase == "kickoff"
        assert inbound.ball.trajectory is not None
        assert inbound.ball.trajectory.type == "inbound"


def test_kickoff_formation_slots_are_respected_and_disjoint():
    result = _make_runner(seed=7).run_simulation(200)

    events = _score_kickoff_events(result)
    assert events

    for event in events:
        reset = result.frames[event.iteration]
        by_id = {
            position.player_id: (position.x, position.y) for position in reset.players
        }
        assert len(by_id) == 10

        possession_is_home = reset.possession_team_id == "home"
        home_slots = (
            get_inbound_positions(is_team_a=True)
            if possession_is_home
            else get_defensive_reset_positions(is_team_a=False)
        )
        away_slots = (
            get_defensive_reset_positions(is_team_a=True)
            if possession_is_home
            else get_inbound_positions(is_team_a=False)
        )

        # Assert each on-court home player sits on a home slot and away on away.
        home_players = {
            position.player_id
            for position in reset.players
            if position.player_id.startswith("h")
        }
        away_players = {
            position.player_id
            for position in reset.players
            if position.player_id.startswith("a")
        }
        home_set = {(slot.x, slot.y) for slot in home_slots}
        away_set = {(slot.x, slot.y) for slot in away_slots}
        assert {by_id[pid] for pid in home_players} == home_set
        assert {by_id[pid] for pid in away_players} == away_set
        assert home_set.isdisjoint(away_set)


def test_kickoff_assigns_lowest_usage_inbounder_and_resets_clock():
    runner = _make_runner(seed=7)
    state = runner.state
    state.flip_possession(rng=runner.rng, pick_handler=False)

    inbounder = state.begin_kickoff()
    team = state.attacking_team
    lowest = min(
        team.get_on_court_players(),
        key=lambda p: p.attributes.usage_rate,
    )
    assert inbounder.player_id == lowest.player_id
    assert state.active_handler_id == lowest.player_id
    assert state.last_passer_id is None
    assert state.clock.shot_clock_remaining == 24.0

    # O recebedor é o companheiro mais próximo do repositor.
    runner.state.awaiting_inbound = True
    transition = runner.fsm.resolve_next_transition(state)
    assert transition.phase == "kickoff"
    assert transition.action_type == "inbound"
    assert transition.target_player_id is not None


def test_kickoff_consumes_exactly_two_transitions():
    result = _make_runner(seed=7).run_simulation(400)

    events = _score_kickoff_events(result)
    assert events

    event = events[0]
    index = event.iteration
    # kickoff (reset) e inbound_pass são as duas transições da reposição.
    assert index < len(result.frames) - 1
    following = result.frames[index + 1]
    assert following.ball.trajectory is not None
    assert following.ball.trajectory.type == "inbound"

    # A transição seguinte já é jogo normal (phase ``None``).
    after_inbound = result.frames[index + 2]
    assert after_inbound.phase is None


def test_inbound_passes_succeed_at_boosted_rate():
    attempts = 0
    turnovers = 0
    for seed in range(1, 30):
        result = _make_runner(seed=seed).run_simulation(200)
        # Um turnover na iteração do passe de fundo indica reposição interceptada.
        turnover_iterations = {
            event.iteration for event in result.events if event.type == "turnover"
        }
        for index, frame in enumerate(result.frames):
            trajectory = frame.ball.trajectory
            if trajectory is None or trajectory.type != "inbound":
                continue
            attempts += 1
            if index in turnover_iterations:
                turnovers += 1
    successes = attempts - turnovers

    assert attempts > 50
    # D4: reposição protegida com no mínimo ~95% de sucesso.
    assert successes / attempts >= 0.92


def test_kickoff_sequence_is_deterministic_for_a_seed():
    first = _make_runner(seed=11).run_simulation(60)
    second = _make_runner(seed=11).run_simulation(60)
    first_kickoffs = [e for e in first.events if e.type == "kickoff"]
    second_kickoffs = [e for e in second.events if e.type == "kickoff"]
    assert first_kickoffs == second_kickoffs


def test_legacy_run_match_path_still_works_with_kickoff():
    for seed in (3, 7, 42):
        log = _make_runner(seed=seed).run_match()
        assert len(log.quarters) == 4
        scores = [quarter.score_home + quarter.score_away for quarter in log.quarters]
        assert scores == sorted(scores)
        assert log.winner in ("home", "away")
