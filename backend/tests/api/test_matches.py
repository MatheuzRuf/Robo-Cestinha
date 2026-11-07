import pytest
from app.api.factories import ServiceFactory
from app.api.routers.matches import simulate_match


@pytest.mark.asyncio
async def test_simulation_route_returns_generated_frames_and_events():
    payload = await simulate_match(
        match_id="demo",
        factory=ServiceFactory(db=None),
        session_hash="demo",
        iterations=1000,
    )

    assert len(payload["frames"]) > 40
    assert len(payload["events"]) > 15
    assert any(event["type"] == "shot_made" for event in payload["events"])
