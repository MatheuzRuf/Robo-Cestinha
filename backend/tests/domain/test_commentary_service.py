import asyncio
import json
from unittest.mock import patch

from app.domain.commentary.service import CommentaryService, _normalize_commentary


def _snapshot():
    return {
        "f": 30,
        "tf": 1000,
        "ev": [{"f": 30, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 2}],
        "st": {
            "sc": {"h": 24, "a": 20},
            "tf": {"HOME": 2, "AWAY": 1},
            "pp": {"Jordan": 8},
        },
    }


def test_normalize_commentary_shortens_overlong_sentence_at_clause_boundary():
    result = _normalize_commentary(
        "Aaron Gordon swishes a jumper to bring Denver back, but the Lakers still lead late!"
    )

    assert result == "Aaron Gordon swishes a jumper to bring Denver back!"
    assert len(result.split()) <= 10


def test_normalize_commentary_rejects_single_word_responses():
    assert _normalize_commentary("Perfect!") is None


def test_generate_batch_requests_ten_snapshots_in_one_provider_call():
    snapshots = [
        {
            **_snapshot(),
            "f": frame,
            "ev": [{"f": frame, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 2}],
        }
        for frame in range(10, 20)
    ]
    response_body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        [
                            {"f": snapshot["f"], "c": "Jordan scores again!"}
                            for snapshot in snapshots
                        ]
                    )
                }
            }
        ]
    }

    with patch("app.domain.commentary.service.urlopen") as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(response_body).encode()

        results = asyncio.run(
            CommentaryService().generate_batch(
                snapshots, ["Jordan opened the scoring on the prior possession!"]
            )
        )

    assert results == [{"f": frame, "c": "Jordan scores again!"} for frame in range(10, 20)]
    response.assert_called_once()
    request = response.call_args.args[0]
    body = json.loads(request.data)
    content = json.loads(body["messages"][1]["content"])
    assert len(content["snapshots"]) == 10
    assert content["recent_commentary"] == [
        "Jordan opened the scoring on the prior possession!"
    ]
    assert "at most 14 words" in body["messages"][0]["content"]
    assert "anchored to the specific event at frame f" in body["messages"][0]["content"]
    assert "Avoid generic reactions" in body["messages"][0]["content"]
    assert "Use the supplied fx facts" in body["messages"][0]["content"]
    assert "do not repeat" in body["messages"][0]["content"]
    assert body["max_tokens"] == 300


def test_generate_batch_replaces_wrong_score_with_frame_grounded_fallback():
    snapshot = _snapshot()
    response_body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        [{"f": snapshot["f"], "c": "Jordan buries a 3-point dunk!"}]
                    )
                }
            }
        ]
    }

    with patch("app.domain.commentary.service.urlopen") as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(response_body).encode()

        results = asyncio.run(CommentaryService().generate_batch([snapshot]))

    assert results == [{"f": 30, "c": "Jordan buries a 2—now at 8!"}]


def test_generate_batch_replaces_single_word_response_with_fallback():
    snapshot = _snapshot()
    response_body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        [{"f": snapshot["f"], "c": "Perfect!"}]
                    )
                }
            }
        ]
    }

    with patch("app.domain.commentary.service.urlopen") as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(response_body).encode()

        results = asyncio.run(CommentaryService().generate_batch([snapshot]))

    assert results == [{"f": 30, "c": "Jordan buries a 2—now at 8!"}]


def test_generate_batch_replaces_wrong_player_attribution():
    snapshot = _snapshot()
    snapshot["ev"].insert(
        0, {"f": 20, "ty": "Score", "p": "Casey", "tm": "AWAY", "pts": 2}
    )
    snapshot["st"]["pp"]["Casey"] = 10
    response_body = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        [{"f": snapshot["f"], "c": "Casey scores again!"}]
                    )
                }
            }
        ]
    }

    with patch("app.domain.commentary.service.urlopen") as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(response_body).encode()

        results = asyncio.run(CommentaryService().generate_batch([snapshot]))

    assert results == [{"f": 30, "c": "Jordan buries a 2—now at 8!"}]


def test_generate_batch_limits_each_snapshot_to_forty_recent_events():
    snapshot = {
        **_snapshot(),
        "f": 50,
        "ev": [
            {"f": frame, "ty": "Pass", "p": "Jordan", "tm": "HOME"}
            for frame in range(1, 51)
        ],
    }

    with patch("app.domain.commentary.service.urlopen") as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                [{"f": snapshot["f"], "c": "What a wild run!"}]
                            )
                        }
                    }
                ]
            }
        ).encode()

        CommentaryService()._generate_batch_sync([snapshot])

    request = response.call_args.args[0]
    sent_content = json.loads(json.loads(request.data)["messages"][1]["content"])
    sent_snapshot = sent_content["snapshots"][0]
    assert len(sent_snapshot["ev"]) == 40
    assert sent_snapshot["ev"][0]["f"] == 11
    assert sent_snapshot["ev"][-1]["f"] == 50
    assert len(snapshot["ev"]) == 50


def test_generate_batch_passes_recent_generated_commentary_to_next_group():
    snapshots = [
        {
            **_snapshot(),
            "f": frame,
            "ev": [{"f": frame, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 2}],
        }
        for frame in range(1, 13)
    ]
    initial_history = ["Jordan opened the scoring with a strong drive!"]
    first_group = [
        {"f": frame, "c": f"Jordan scores at frame {frame}!"}
        for frame in range(1, 11)
    ]
    second_group = [
        {"f": frame, "c": f"Jordan scores at frame {frame}!"}
        for frame in range(11, 13)
    ]

    with patch.object(
        CommentaryService,
        "_generate_batch_sync",
        side_effect=[first_group, second_group],
    ) as generate_sync:
        asyncio.run(
            CommentaryService().generate_batch(snapshots, initial_history)
        )

    assert generate_sync.call_args_list[0].args[1] == initial_history
    assert generate_sync.call_args_list[1].args[1] == [
        f"Jordan scores at frame {frame}!" for frame in range(6, 11)
    ]


def test_generate_batch_uses_event_grounded_fallback_for_provider_failures():
    snapshots = [
        {
            **_snapshot(),
            "f": 42,
            "ev": [
                {"f": 30, "ty": "Pass", "p": "Jordan", "tm": "HOME"},
                {"f": 42, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 3},
            ],
        }
    ]

    with patch.object(
        CommentaryService,
        "_generate_batch_sync",
        side_effect=TimeoutError("provider unavailable"),
    ):
        results = asyncio.run(CommentaryService().generate_batch(snapshots))

    assert results == [{"f": 42, "c": "Jordan buries a 3—now at 8!"}]


def test_generate_batch_fills_missing_provider_items_with_event_fallback():
    snapshots = [
        {
            **_snapshot(),
            "f": 42,
            "ev": [{"f": 42, "ty": "Steal", "p": "Jordan", "tm": "HOME"}],
        },
        {
            **_snapshot(),
            "f": 43,
            "ev": [{"f": 43, "ty": "Block", "p": "Casey", "tm": "AWAY"}],
        },
    ]

    with patch(
        "app.domain.commentary.service.urlopen",
    ) as response:
        mock_response = response.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                [{"f": 42, "c": "Jordan jumps the passing lane!"}]
                            )
                        }
                    }
                ]
            }
        ).encode()

        results = asyncio.run(CommentaryService().generate_batch(snapshots))

    assert results == [
        {"f": 42, "c": "Jordan jumps the passing lane!"},
        {"f": 43, "c": "Casey sends that shot back!"},
    ]


def test_generate_batch_splits_more_than_ten_snapshots():
    snapshots = [
        {
            **_snapshot(),
            "f": frame,
            "ev": [{"f": frame, "ty": "Score", "p": "Jordan", "tm": "HOME", "pts": 2}],
        }
        for frame in range(1, 13)
    ]

    with patch.object(
        CommentaryService,
        "_generate_batch_sync",
        side_effect=[
            [{"f": frame, "c": f"Frame {frame} scores!"} for frame in range(1, 11)],
            [{"f": frame, "c": f"Frame {frame} scores!"} for frame in range(11, 13)],
        ],
    ) as generate_sync:
        results = asyncio.run(CommentaryService().generate_batch(snapshots))

    assert [result["f"] for result in results] == list(range(1, 13))
    assert generate_sync.call_count == 2
    assert [len(call.args[0]) for call in generate_sync.call_args_list] == [10, 2]
