import uuid

from fastapi.testclient import TestClient

from app.api.factories import ServiceFactory
from app.api.main import app
from app.domain.matches.errors import (
    MatchAlreadySimulatedError,
    MatchNotReadyError,
    MatchOrSessionNotFoundError,
    SimulationFailedError,
)
from app.domain.matches.types import MatchSimulationResult


class FakeService:
    def __init__(self, outcome=None, error=None):
        self.outcome = outcome or _result()
        self.error = error

    async def simulate_match(self, session_hash, match_id, iterations):
        if self.error is not None:
            raise self.error
        return self.outcome


class FakeFactory:
    def __init__(self, service=None, error=None):
        if service is not None:
            self.service = service
        else:
            self.service = FakeService(error=error)

    def match_service(self):
        return self.service


def _result():
    home = uuid.uuid4()
    away = uuid.uuid4()
    player_ids = [uuid.uuid4() for _ in range(10)]

    def frame(iteration, home_score=0, away_score=0):
        return {
            "iteration": iteration,
            "playerWithBallId": str(player_ids[0]),
            "players": [{"playerId": str(pid), "x": 40, "y": 25} for pid in player_ids],
            "ball": {"x": 47, "y": 25, "height": 0, "trajectory": None},
            "score": {"home": home_score, "away": away_score},
            "possessionTeamId": str(home),
        }

    return MatchSimulationResult(
        match_id=uuid.uuid4(),
        session_hash="RC-X",
        iterations_limit=1,
        iterations_completed=1,
        overtime_iterations=0,
        termination_reason="iteration_limit",
        home_score=2,
        away_score=0,
        winner_team_id=home,
        teams={
            "home": {"teamId": home, "name": "Home", "abbreviation": "HM"},
            "away": {"teamId": away, "name": "Away", "abbreviation": "AW"},
        },
        players=[
            {
                "playerId": player_ids[i],
                "teamId": home if i < 5 else away,
                "side": "home" if i < 5 else "away",
                "name": f"P{i}",
                "position": "PG",
                "number": None,
            }
            for i in range(10)
        ],
        frames=[frame(0), frame(1, home_score=2)],
        events=[
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
                "teamId": home,
                "playerId": player_ids[0],
                "targetPlayerId": None,
                "data": {"pointsScored": 2, "scoreAfter": {"home": 2, "away": 0}},
            },
        ],
        engine_version="1.0.0",
    )


def _client(error=None):
    app.dependency_overrides[ServiceFactory] = lambda: FakeFactory(error=error)
    return TestClient(app)


def _teardown():
    app.dependency_overrides.clear()


def test_simulation_returns_created_with_response_shape():
    client = _client()
    match_id = uuid.uuid4()
    response = client.post(
        f"/matches/{match_id}/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["match"]["status"] == "finished"
    assert body["simulation"]["status"] == "completed"
    assert len(body["players"]) == 10
    assert body["summary"]["winnerTeamId"]
    _teardown()


def test_simulation_rejects_non_uuid_match_id():
    client = _client()
    response = client.post(
        "/matches/demo/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 422
    _teardown()


def test_simulation_returns_404_for_missing_match_or_session():
    client = _client(error=MatchOrSessionNotFoundError("x"))
    response = client.post(
        f"/matches/{uuid.uuid4()}/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "match_or_session_not_found"
    _teardown()


def test_simulation_returns_409_for_unready_match():
    client = _client(error=MatchNotReadyError("x"))
    response = client.post(
        f"/matches/{uuid.uuid4()}/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "match_not_ready"
    _teardown()


def test_simulation_returns_409_for_duplicate_run():
    client = _client(error=MatchAlreadySimulatedError("x"))
    response = client.post(
        f"/matches/{uuid.uuid4()}/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "match_already_simulated"
    _teardown()


def test_simulation_returns_500_on_failed_run():
    client = _client(error=SimulationFailedError("x"))
    response = client.post(
        f"/matches/{uuid.uuid4()}/simulation",
        json={"sessionHash": "RC-X", "iterations": 1},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "simulation_failed"
    _teardown()


def test_timeline_endpoint_is_not_registered():
    paths = app.openapi()["paths"]
    assert "/matches/{match_id}/timeline" not in paths
    assert "/matches/{match_id}/simulation" in paths
