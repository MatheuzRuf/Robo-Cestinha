import json

import pytest
from app.api.factories import ServiceFactory
from app.api.routers.matches import simulate_match, stream_match


@pytest.mark.asyncio
async def test_match_stream_starts_with_snapshot():
    response = await stream_match(match_id="demo")
    messages = response.body_iterator
    first_message = await anext(messages)
    payload = json.loads(first_message.split("data: ", maxsplit=1)[1])

    assert response.media_type == "text/event-stream"
    assert response.headers["cache-control"] == "no-cache"
    assert payload["type"] == "snapshot"
    assert payload["payload"]["matchId"] == "demo"
    assert payload["payload"]["frame"]["players"]
    await messages.aclose()


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
