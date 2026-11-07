import uuid

import pytest
from pydantic import ValidationError

from app.api.schemas.match_simulation import (
    MatchSimulationResponse,
    PlayerPositionSchema,
    SimulateMatchRequest,
)


def _players(player_ids):
    return [{"playerId": pid, "x": 40, "y": 25} for pid in player_ids]


def _valid_payload(iterations_completed=1):
    player_ids = [uuid.uuid4() for _ in range(10)]
    home = uuid.uuid4()
    away = uuid.uuid4()
    return {
        "match": {
            "matchId": str(uuid.uuid4()),
            "sessionHash": "RC-X",
            "status": "finished",
        },
        "simulation": {
            "status": "completed",
            "iterationsLimit": 1,
            "iterationsCompleted": iterations_completed,
            "overtimeIterations": 0,
            "terminationReason": "iteration_limit",
        },
        "teams": {
            "home": {"teamId": str(home), "name": "Home", "abbreviation": "HM"},
            "away": {"teamId": str(away), "name": "Away", "abbreviation": "AW"},
        },
        "players": [
            {
                "playerId": str(player_ids[i]),
                "teamId": str(home if i < 5 else away),
                "side": "home" if i < 5 else "away",
                "name": f"P{i}",
                "position": "PG",
                "number": None,
            }
            for i in range(10)
        ],
        "frames": [
            {
                "iteration": 0,
                "playerWithBallId": str(player_ids[0]),
                "players": _players(player_ids),
                "ball": {"x": 47, "y": 25, "height": 0, "trajectory": None},
                "score": {"home": 0, "away": 0},
                "possessionTeamId": str(home),
            },
            {
                "iteration": 1,
                "playerWithBallId": str(player_ids[0]),
                "players": _players(player_ids),
                "ball": {"x": 47, "y": 25, "trajectory": None},
                "score": {"home": 2, "away": 0},
                "possessionTeamId": str(home),
            },
        ],
        "events": [
            {
                "sequence": 1,
                "iteration": 0,
                "type": "game_started",
                "teamId": None,
                "playerId": None,
                "targetPlayerId": None,
                "data": {},
            },
            {
                "sequence": 2,
                "iteration": 1,
                "type": "shot_made",
                "teamId": str(home),
                "playerId": str(player_ids[0]),
                "targetPlayerId": None,
                "data": {"pointsScored": 2, "scoreAfter": {"home": 2, "away": 0}},
            },
        ],
        "summary": {"homeScore": 2, "awayScore": 0, "winnerTeamId": str(home)},
    }


def _make_player_id():
    return uuid.uuid4()


def test_request_rejects_zero_iterations():
    with pytest.raises(ValidationError):
        SimulateMatchRequest(sessionHash="RC-X", iterations=0)


def test_request_accepts_positive_iterations():
    request = SimulateMatchRequest(sessionHash="RC-X", iterations=1)
    assert request.iterations == 1


def test_response_accepts_valid_payload():
    response = MatchSimulationResponse.model_validate(_valid_payload())
    assert response.simulation.iterationsCompleted == 1


def test_response_rejects_non_contiguous_frames():
    payload = _valid_payload()
    payload["frames"][1]["iteration"] = 2
    with pytest.raises(ValidationError):
        MatchSimulationResponse.model_validate(payload)


def test_response_rejects_wrong_frame_count():
    payload = _valid_payload(iterations_completed=5)
    with pytest.raises(ValidationError):
        MatchSimulationResponse.model_validate(payload)


def test_response_rejects_frames_with_wrong_player_count():
    payload = _valid_payload()
    payload["frames"][0]["players"] = payload["frames"][0]["players"][:9]
    with pytest.raises(ValidationError):
        MatchSimulationResponse.model_validate(payload)


def test_player_position_enforces_court_bounds():
    with pytest.raises(ValidationError):
        PlayerPositionSchema(playerId=_make_player_id(), x=95, y=25)
    with pytest.raises(ValidationError):
        PlayerPositionSchema(playerId=_make_player_id(), x=40, y=51)
