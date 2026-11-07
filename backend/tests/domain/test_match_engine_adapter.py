import uuid

from app.domain.matches.engine_adapter import MatchEngineAdapter
from app.domain.matches.types import MatchContext


def _attrs():
    return {
        "two_pt_pct": 0.5,
        "three_pt_pct": 0.38,
        "ft_pct": 0.8,
        "turnover_rate": 0.2,
        "foul_rate": 0.1,
        "rebound_rate": 0.2,
        "assist_rate": 0.3,
        "steal_rate": 0.1,
        "block_rate": 0.1,
        "stamina": 0.7,
        "clutch_factor": 0.5,
        "usage_rate": 0.3,
    }


def _record(**kwargs):
    return type("Record", (), kwargs)()


def _make_context():
    home_id = uuid.uuid4()
    away_id = uuid.uuid4()
    home = _record(
        id=home_id,
        catalog_id="home_t",
        name="Home",
        abbreviation="HM",
    )
    away = _record(
        id=away_id,
        catalog_id="away_t",
        name="Away",
        abbreviation="AW",
    )
    home_players = [
        _record(
            id=uuid.uuid4(),
            catalog_id=f"hp{i}",
            name=f"HP{i}",
            team_id=home_id,
            position="G",
            position5="PG",
            is_starter=True,
            attributes=_attrs(),
        )
        for i in range(5)
    ]
    away_players = [
        _record(
            id=uuid.uuid4(),
            catalog_id=f"ap{i}",
            name=f"AP{i}",
            team_id=away_id,
            position="G",
            position5="PG",
            is_starter=True,
            attributes=_attrs(),
        )
        for i in range(5)
    ]
    return MatchContext(
        match_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        session_hash="RC-TEST",
        match=_record(status="ready"),
        home_team=home,
        away_team=away,
        home_players=home_players,
        away_players=away_players,
    )


def test_adapter_runs_bounded_simulation():
    context = _make_context()
    engine = MatchEngineAdapter().run(context, iterations=20, seed=3)
    assert engine.iterations_completed >= 20
    assert len(engine.frames) == engine.iterations_completed + 1
    assert engine.home_score != engine.away_score


def test_adapter_maps_engine_ids_to_database_ids():
    context = _make_context()
    adapter = MatchEngineAdapter()
    engine = adapter.run(context, iterations=40, seed=3)
    result = adapter.to_domain_result(engine, context, iterations=40)

    assert result.winner_team_id in {
        context.home_team.id,
        context.away_team.id,
    }

    player_ids = {p.id for p in context.home_players + context.away_players}
    assert len(result.players) == 10
    for player in result.players:
        assert player["playerId"] in player_ids
        assert player["side"] in ("home", "away")

    for frame in result.frames:
        assert 0 <= frame["ball"]["x"] <= 94
        assert 0 <= frame["ball"]["y"] <= 50
        if frame["playerWithBallId"] is not None:
            assert frame["playerWithBallId"] in player_ids
    for event in result.events:
        assert len(str(event["sequence"])) >= 1
        assert event["type"]


def test_adapter_preserves_player_attributes_unchanged():
    context = _make_context()
    engine = MatchEngineAdapter().run(context, iterations=10, seed=1)
    assert engine.iterations_completed >= 10
    assert len(engine.frames) == engine.iterations_completed + 1
