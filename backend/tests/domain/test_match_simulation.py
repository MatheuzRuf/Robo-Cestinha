import pytest
from app.domain.matches.service import MockSimulationService


def test_mock_simulation_contains_frames_events_and_scoring_plays():
    service = MockSimulationService()

    payload = service.run_simulation("demo", "demo", 1000)

    assert len(payload["frames"]) > 40
    assert len(payload["events"]) > 15
    event_types = {event["type"] for event in payload["events"]}
    assert "pass_completed" in event_types
    assert "shot_made" in event_types
    assert "shot_missed" in event_types


def test_mock_simulation_keeps_ball_with_a_player_or_on_a_defined_path():
    payload = MockSimulationService().run_simulation("demo", "demo", 1000)

    for frame in payload["frames"]:
        players_by_id = {player["playerId"]: player for player in frame["players"]}
        holder_id = frame["playerWithBallId"]

        if holder_id is not None:
            holder = players_by_id[holder_id]
            assert frame["ball"]["x"] == holder["x"]
            assert frame["ball"]["y"] == holder["y"]
            assert frame["ball"]["trajectory"] is None
            continue

        trajectory = frame["ball"]["trajectory"]
        assert trajectory is not None
        progress = trajectory["progress"]
        expected_x = (
            trajectory["fromPosition"]["x"]
            + (trajectory["toPosition"]["x"] - trajectory["fromPosition"]["x"])
            * progress
        )
        expected_y = (
            trajectory["fromPosition"]["y"]
            + (trajectory["toPosition"]["y"] - trajectory["fromPosition"]["y"])
            * progress
        )
        assert frame["ball"]["x"] == pytest.approx(expected_x, abs=0.001)
        assert frame["ball"]["y"] == pytest.approx(expected_y, abs=0.001)


def test_mock_simulation_is_reproducible_for_a_match_and_session():
    service = MockSimulationService()

    first = service.run_simulation("demo", "demo", 1000)
    second = service.run_simulation("demo", "demo", 1000)

    assert first == second


def test_mock_simulation_does_not_exceed_requested_frame_iterations():
    payload = MockSimulationService().run_simulation("demo", "short", 20)

    assert len(payload["frames"]) <= 21
    assert payload["simulation"]["iterationsCompleted"] <= 20
