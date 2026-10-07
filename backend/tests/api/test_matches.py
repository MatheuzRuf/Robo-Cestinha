import json

import pytest
from app.api.routers.matches import stream_match


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
