from app.api.main import app
from app.domain.commentary.service import CommentaryService
from fastapi.testclient import TestClient


def test_commentary_route_rejects_more_than_forty_events():
    payload = {
        "snapshots": [
            {
                "f": 30,
                "tf": 1000,
                "ev": [{"f": frame, "ty": "Score"} for frame in range(41)],
                "st": {"sc": {"h": 0, "a": 0}, "tf": {}, "pp": {}},
            }
        ]
    }

    with TestClient(app) as client:
        response = client.post("/commentary/batch", json=payload)

    assert response.status_code == 422


def test_commentary_batch_route_accepts_forty_event_window(monkeypatch):
    async def generate_batch(self, snapshots):
        assert len(snapshots[0]["ev"]) == 40
        return [{"f": snapshots[0]["f"], "c": "What a wild run!"}]

    monkeypatch.setattr(CommentaryService, "generate_batch", generate_batch)
    payload = {
        "snapshots": [
            {
                "f": 30,
                "tf": 1000,
                "ev": [{"f": frame, "ty": "Pass"} for frame in range(40)],
                "st": {"sc": {"h": 0, "a": 0}, "tf": {}, "pp": {}},
            }
        ]
    }

    with TestClient(app) as client:
        response = client.post("/commentary/batch", json=payload)

    assert response.status_code == 200


def test_commentary_batch_route_preserves_frame_associations(monkeypatch):
    async def generate_batch(self, snapshots):
        assert [snapshot["f"] for snapshot in snapshots] == [10, 20]
        return [{"f": 10, "c": "Jordan scores!"}, {"f": 20, "c": None}]

    monkeypatch.setattr(CommentaryService, "generate_batch", generate_batch)
    payload = {
        "snapshots": [
            {
                "f": frame,
                "tf": 1000,
                "ev": [{"f": frame, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 2}],
                "st": {"sc": {"h": frame, "a": 0}, "tf": {}, "pp": {"Jordan": frame}},
            }
            for frame in (10, 20)
        ]
    }

    with TestClient(app) as client:
        response = client.post("/commentary/batch", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "commentaries": [{"f": 10, "c": "Jordan scores!"}, {"f": 20, "c": None}]
    }
