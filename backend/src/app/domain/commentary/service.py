"""Generate grounded basketball commentary through Pollinations."""

from __future__ import annotations

import asyncio
import http.client
import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

_ENDPOINT = "https://text.pollinations.ai/openai"
_MODEL = "openai"
_TIMEOUT_SECONDS = 10
_MAX_COMMENTARY_WORDS = 14
_RECENT_EVENT_WINDOW_SIZE = 40
_SYSTEM_PROMPT = (
    "You are an excited basketball commentator writing for a live Twitch chat. "
    "You will receive an array of up to ten snapshots. For each snapshot, create "
    "one brief play-by-play reaction anchored to the specific event at frame f. "
    "Use the wider recent-event window and current stats to add relevant context, "
    "such as a scoring run, comeback, or defensive stop, only when supported. "
    "Name the player or team involved when available. Be vivid and emotional, "
    "but do not list a sequence of actions or recap the whole window. Avoid generic "
    "reactions. Prefer 8-12 words, with at most 14 words. "
    "Return only a valid JSON array with one object per input, "
    'each exactly shaped as {"f": frame_number, "c": "one sentence"}. Preserve '
    "each input f value exactly and return results in the same order. No markdown "
    "or extra keys. Never invent players, events, scores, or statistics. Treat "
    "current stats as authoritative and do not infer totals from the recent event "
    "window. Mention only facts directly supported by the corresponding snapshot. "
    "Do not invent crowd reactions or describe unsupported events. "
    "The snapshot f and tf fields mean current frame out of total frames and can "
    "indicate an end-of-game situation. Keep each sentence energetic and at most "
    "14 words. Example style: 'Clowney jumps the lane and Brooklyn steals the momentum!'"
)
_BATCH_SIZE = 10
_MAX_CONCURRENT_BATCHES = 2


class CommentaryService:
    """Request short commentary completions from Pollinations."""

    async def generate_batch(
        self, snapshots: list[dict[str, object]]
    ) -> list[dict[str, object]]:
        """Generate commentary for snapshots in groups of ten.

        Args:
            snapshots: Ordered snapshots from a completed simulation.

        Returns:
            One frame-indexed result for each input snapshot.
        """

        if not snapshots:
            return []

        semaphore = asyncio.Semaphore(_MAX_CONCURRENT_BATCHES)

        async def generate_group(
            group: list[dict[str, object]],
        ) -> list[dict[str, object]]:
            async with semaphore:
                try:
                    return await asyncio.to_thread(self._generate_batch_sync, group)
                except (
                    HTTPError,
                    URLError,
                    TimeoutError,
                    OSError,
                    http.client.HTTPException,
                    json.JSONDecodeError,
                    KeyError,
                    IndexError,
                    TypeError,
                    UnicodeDecodeError,
                ) as error:
                    logger.warning(
                        "Commentary batch request failed (%s).",
                        type(error).__name__,
                    )
                    return [
                        {
                            "f": snapshot["f"],
                            "c": _fallback_commentary(snapshot),
                        }
                        for snapshot in group
                    ]

        groups = [
            snapshots[index : index + _BATCH_SIZE]
            for index in range(0, len(snapshots), _BATCH_SIZE)
        ]
        generated_groups = await asyncio.gather(
            *(generate_group(group) for group in groups)
        )
        generated_by_frame = {
            result["f"]: result["c"]
            for group in generated_groups
            for result in group
        }
        return [
            {"f": snapshot["f"], "c": generated_by_frame.get(snapshot["f"])}
            for snapshot in snapshots
        ]

    @staticmethod
    def _generate_batch_sync(
        snapshots: list[dict[str, object]],
    ) -> list[dict[str, object]]:
        """Generate and validate commentary for one batch of up to ten frames.

        Args:
            snapshots: Snapshots sent together in one provider request.

        Returns:
            Frame-indexed generated commentary, with ``None`` for invalid items.
        """

        snapshots = [
            {
                **snapshot,
                "ev": snapshot.get("ev", [])[-_RECENT_EVENT_WINDOW_SIZE:],
            }
            for snapshot in snapshots
        ]
        payload = {
            "model": _MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(snapshots, separators=(",", ":")),
                },
            ],
            "max_tokens": 300,
        }
        request = Request(
            _ENDPOINT,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise URLError(f"HTTP {response.status}")
            completion = json.loads(response.read())

        try:
            content = completion["choices"][0]["message"]["content"]
            generated = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            logger.warning("Commentary provider returned an invalid batch.")
            return [
                {"f": snapshot["f"], "c": _fallback_commentary(snapshot)}
                for snapshot in snapshots
            ]

        if not isinstance(generated, list):
            logger.warning("Commentary provider returned an invalid batch.")
            return [
                {"f": snapshot["f"], "c": _fallback_commentary(snapshot)}
                for snapshot in snapshots
            ]

        inputs_by_frame = {snapshot["f"]: snapshot for snapshot in snapshots}
        results_by_frame: dict[int, str | None] = {}
        for item in generated:
            if not isinstance(item, dict):
                continue
            frame = item.get("f")
            text = item.get("c")
            if (
                not isinstance(frame, int)
                or frame not in inputs_by_frame
                or frame in results_by_frame
                or not isinstance(text, str)
            ):
                continue

            normalized = _normalize_commentary(text)
            snapshot_json = json.dumps(
                inputs_by_frame[frame], separators=(",", ":")
            )
            allowed_numbers = {
                int(number) for number in re.findall(r"\d+", snapshot_json)
            }
            if normalized is not None and any(
                int(number) not in allowed_numbers
                for number in re.findall(r"\d+", normalized)
            ):
                normalized = None
            results_by_frame[frame] = normalized or _fallback_commentary(
                inputs_by_frame[frame]
            )

        return [
            {
                "f": snapshot["f"],
                "c": results_by_frame.get(snapshot["f"])
                or _fallback_commentary(snapshot),
            }
            for snapshot in snapshots
        ]


def _fallback_commentary(snapshot: dict[str, object]) -> str:
    events = snapshot.get("ev", [])
    significant_types = {
        "score",
        "foul",
        "timeout",
        "turnover",
        "steal",
        "block",
        "substitution",
        "quarterend",
    }
    current_events = [item for item in events if item.get("f") == snapshot["f"]]
    event = next(
        (
            item
            for item in reversed(current_events)
            if str(item.get("ty") or "").lower() in significant_types
        ),
        next(
            (
                item
                for item in reversed(events)
                if str(item.get("ty") or "").lower() in significant_types
            ),
            current_events[-1] if current_events else (events[-1] if events else {}),
        ),
    )
    player = str(event.get("p") or "").strip()
    team = str(event.get("tm") or "").strip()
    subject = player or team
    event_type = str(event.get("ty") or "").lower()

    if event_type == "score":
        points = event.get("pts")
        player_points = snapshot.get("st", {}).get("pp", {}).get(player)
        if player and isinstance(points, int) and isinstance(player_points, int):
            return f"{player} buries a {points}—now at {player_points}!"
        if player and isinstance(points, int):
            return f"{player} buries the {points}-point shot!"
        return f"{subject or 'They'} knock down the shot!"
    if event_type == "steal":
        verb = "jumps" if subject else "jump"
        return f"{subject} {verb} the passing lane!" if subject else "They jump the passing lane!"
    if event_type == "turnover":
        return (
            f"{subject} coughs it up—what a swing!"
            if subject
            else "They cough it up—what a swing!"
        )
    if event_type == "block":
        return (
            f"{subject} sends that shot back!"
            if subject
            else "They send that shot back!"
        )
    if event_type == "foul":
        return f"Big whistle on {subject}!" if subject else "A huge whistle changes the possession!"
    if event_type == "timeout":
        return f"{team or 'The team'} stops play—big moment!"
    if event_type == "substitution":
        return f"Fresh legs for {team or 'the team'}!"
    if event_type == "quarterend":
        return "That quarter ends with the pressure rising!"
    return f"{subject or 'The game'} brings another big moment!"


def _normalize_commentary(content: str) -> str | None:
    normalized = content.strip()
    if len(normalized) >= 2 and (
        (normalized.startswith('"') and normalized.endswith('"'))
        or (normalized.startswith("'") and normalized.endswith("'"))
    ):
        normalized = normalized[1:-1].strip()
    normalized = " ".join(normalized.split())
    normalized = re.split(r"(?<=[.!?])\s+", normalized, maxsplit=1)[0]
    words = normalized.split()
    if len(words) > _MAX_COMMENTARY_WORDS:
        clauses = re.split(
            r"[,;—–]+|\s+(?:but|while|and)\s+",
            normalized,
            flags=re.IGNORECASE,
        )
        concise_clause = max(
            (clause.strip() for clause in clauses if len(clause.split()) <= _MAX_COMMENTARY_WORDS),
            key=len,
            default="",
        )
        if concise_clause:
            normalized = concise_clause
        else:
            normalized = " ".join(words[:_MAX_COMMENTARY_WORDS]).rstrip(",;:—–-")
        if normalized and normalized[-1] not in ".!?":
            normalized += "!"
    return normalized or None
