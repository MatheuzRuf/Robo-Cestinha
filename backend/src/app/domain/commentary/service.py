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
_MIN_COMMENTARY_WORDS = 2
_MAX_COMMENTARY_WORDS = 14
_RECENT_EVENT_WINDOW_SIZE = 40
_RECENT_COMMENTARY_WINDOW_SIZE = 5
_SYSTEM_PROMPT = (
    "You are an excited basketball commentator writing for a live Twitch chat. "
    "You will receive an object with recent_commentary and an array of up to ten "
    "snapshots. Treat recent_commentary as messages already sent: do not repeat "
    "or closely paraphrase their wording, event, or angle. Each new line should "
    "add a distinct next reaction; keep comments in the same response distinct "
    "from one another too. Recent commentary is not evidence for new facts. "
    "For each snapshot, create "
    "one brief play-by-play reaction anchored to the specific event at frame f. "
    "Use the wider recent-event window and current stats to add relevant context, "
    "such as a scoring run, comeback, or defensive stop, only when supported. "
    "Name the player or team involved when available. Be vivid and emotional, "
    "but do not list a sequence of actions or recap the whole window. Avoid generic "
    "reactions. Prefer 8-12 words, with at most 14 words. Use the supplied fx "
    "facts to choose a meaningful angle when relevant; their numbers are computed "
    "from the simulation and must be repeated exactly, never altered or combined. "
    "Only use shot points from the event at frame f, and never attach a player's "
    "name to another frame's play. Write at least two words. "
    "Facts are optional; if none apply, react to the event at frame f. "
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


class CommentaryService:
    """Request short commentary completions from Pollinations."""

    async def generate_batch(
        self,
        snapshots: list[dict[str, object]],
        recent_commentary: list[str] | None = None,
    ) -> list[dict[str, object]]:
        """Generate commentary for snapshots in groups of ten.

        Args:
            snapshots: Ordered snapshots from a completed simulation.
            recent_commentary: Most recent lines sent before these snapshots.

        Returns:
            One frame-indexed result for each input snapshot.
        """

        if not snapshots:
            return []

        groups = [
            snapshots[index : index + _BATCH_SIZE]
            for index in range(0, len(snapshots), _BATCH_SIZE)
        ]
        recent = list((recent_commentary or [])[-_RECENT_COMMENTARY_WINDOW_SIZE:])
        generated_groups = []
        for group in groups:
            try:
                generated = await asyncio.to_thread(
                    self._generate_batch_sync, group, recent.copy()
                )
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
                generated = [
                    {
                        "f": snapshot["f"],
                        "c": _fallback_commentary(snapshot),
                    }
                    for snapshot in group
                ]
            generated_groups.append(generated)
            recent.extend(
                result["c"]
                for result in generated
                if isinstance(result.get("c"), str)
            )
            recent = recent[-_RECENT_COMMENTARY_WINDOW_SIZE:]

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
        recent_commentary: list[str] | None = None,
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
                    "content": json.dumps(
                        {
                            "recent_commentary": (
                                recent_commentary or []
                            )[-_RECENT_COMMENTARY_WINDOW_SIZE:],
                            "snapshots": snapshots,
                        },
                        separators=(",", ":"),
                    ),
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
            snapshot = inputs_by_frame[frame]
            if normalized is not None and (
                not _has_supported_numbers(normalized, snapshot)
                or not _is_grounded_in_snapshot(normalized, snapshot)
            ):
                normalized = None
            results_by_frame[frame] = normalized or _fallback_commentary(
                snapshot
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
    if len(words) < _MIN_COMMENTARY_WORDS:
        return None
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
    return (
        normalized
        if len(normalized.split()) >= _MIN_COMMENTARY_WORDS
        else None
    )


def _has_supported_numbers(
    commentary: str, snapshot: dict[str, object]
) -> bool:
    supported_numbers = {
        int(number)
        for fact in snapshot.get("fx", [])
        if isinstance(fact, dict)
        for number in re.findall(r"\d+", str(fact.get("t") or ""))
    }
    for event in snapshot.get("ev", []):
        if not isinstance(event, dict) or event.get("f") != snapshot.get("f"):
            continue
        points = event.get("pts")
        if isinstance(points, int) and not isinstance(points, bool):
            supported_numbers.add(points)
    return all(
        int(number) in supported_numbers
        for number in re.findall(r"\d+", commentary)
    )


def _is_grounded_in_snapshot(
    commentary: str, snapshot: dict[str, object]
) -> bool:
    frame = snapshot.get("f")
    events = [event for event in snapshot.get("ev", []) if isinstance(event, dict)]
    current_events = [event for event in events if event.get("f") == frame]
    stats = snapshot.get("st")
    stats = stats if isinstance(stats, dict) else {}
    player_points = stats.get("pp")
    team_fouls = stats.get("tf")
    known_players = {
        str(name).strip()
        for name in (player_points.keys() if isinstance(player_points, dict) else [])
        if str(name).strip()
    }
    known_players.update(
        str(event.get("p") or "").strip()
        for event in events
        if str(event.get("p") or "").strip()
    )
    known_teams = {
        str(name).strip()
        for name in (team_fouls.keys() if isinstance(team_fouls, dict) else [])
        if str(name).strip()
    }
    known_teams.update(
        str(event.get("tm") or "").strip()
        for event in events
        if str(event.get("tm") or "").strip()
    )
    facts = [
        fact for fact in snapshot.get("fx", []) if isinstance(fact, dict)
    ]
    facts_text = " ".join(str(fact.get("t") or "") for fact in facts)
    current_entities = {
        str(event.get(key) or "").strip()
        for event in current_events
        for key in ("p", "tm")
        if str(event.get(key) or "").strip()
    }
    fact_entities = {
        entity
        for entity in known_players | known_teams
        if _contains_entity(facts_text, entity)
    }
    allowed_entities = current_entities | fact_entities
    mentioned_entities = {
        entity
        for entity in known_players | known_teams
        if _contains_entity(commentary, entity)
    }
    if mentioned_entities - allowed_entities:
        return False
    if any(_contains_entity(commentary, entity) for entity in allowed_entities):
        return True

    words = set(re.findall(r"[a-z]+", commentary.casefold()))
    fact_terms = {
        "top": {"point", "points", "scorer", "scoring", "high"},
        "hot": {"point", "points", "scorer", "scoring", "hot", "fire"},
        "run": {"unanswered", "run", "points", "scoring"},
        "streak": {"streak", "shot", "shots", "scoring"},
        "cold": {"scoreless", "scoring", "cold", "points"},
        "fouls": {"foul", "fouls"},
        "lead": {"lead", "changes", "change", "tie", "ties"},
        "close": {"close", "within", "tight"},
        "blowout": {"lead", "blowout", "ahead"},
        "endgame": {"endgame", "final", "finish", "frame"},
        "turnovers": {"turnover", "turnovers", "giveaway"},
    }
    return any(
        words & fact_terms.get(str(fact.get("k")), set())
        for fact in facts
    )


def _contains_entity(text: str, entity: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(entity)}(?!\w)",
            text,
            flags=re.IGNORECASE,
        )
    )
