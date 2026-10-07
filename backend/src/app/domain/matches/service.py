"""Domain service that builds a deterministic mock match timeline."""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any


class MockTimelineService:
    """Create a complete match timeline payload for the broadcast UI.

    The implementation is intentionally thin and deterministic so the same
    match id yields the same payload. It is designed to be replaced later by a
    real engine-backed service without changing the API contract.
    """

    def get_timeline(self, match_id: str, locale: str = "en-US") -> dict[str, Any]:
        """Return a complete mock timeline for a match.

        Args:
            match_id: Unique identifier used to seed the mock data.
            locale: Target locale used for narration slots.

        Returns:
            A payload matching the frontend timeline contract.
        """

        rng = random.Random(f"{match_id}:{locale}")
        home = {
            "abbreviation": "CS",
            "name": "CHICAGO STEEL",
            "score": 84,
            "seed": "SEED #1",
            "possession": True,
            "fouls": {"current": 3, "max": 5},
            "timeouts": {"remaining": 1, "total": 3},
        }
        away = {
            "abbreviation": "BB",
            "name": "BROOKLYN BREAKERS",
            "score": 81,
            "seed": "SEED #2",
            "possession": False,
            "fouls": {"current": 4, "max": 5},
            "timeouts": {"remaining": 2, "total": 3},
        }

        players = [
            {"id": "home-0", "team": "home", "x": 18.0, "y": 12.0, "name": "Miller", "number": 7, "position": "PG"},
            {"id": "home-1", "team": "home", "x": 24.0, "y": 20.0, "name": "Walker", "number": 33, "position": "PF"},
            {"id": "home-2", "team": "home", "x": 30.0, "y": 30.0, "name": "King", "number": 55, "position": "C"},
            {"id": "home-3", "team": "home", "x": 38.0, "y": 18.0, "name": "Wash", "number": 24, "position": "SF"},
            {"id": "home-4", "team": "home", "x": 44.0, "y": 25.0, "name": "Johnson", "number": 11, "position": "PF"},
            {"id": "away-0", "team": "away", "x": 62.0, "y": 16.0, "name": "Dinwiddie", "number": 8, "position": "PG"},
            {"id": "away-1", "team": "away", "x": 58.0, "y": 24.0, "name": "Bridges", "number": 1, "position": "SG"},
            {"id": "away-2", "team": "away", "x": 52.0, "y": 30.0, "name": "Claxton", "number": 33, "position": "C"},
            {"id": "away-3", "team": "away", "x": 70.0, "y": 22.0, "name": "Finney", "number": 10, "position": "SF"},
            {"id": "away-4", "team": "away", "x": 68.0, "y": 28.0, "name": "Vance", "number": 4, "position": "SG"},
        ]

        ball = {"x": 30.5, "y": 19.5}
        frame = {"players": players, "ball": ball}
        frames = [
            {"players": [self._shift_player(player, 0.5, 0.5) for player in players], "ball": {"x": ball["x"], "y": ball["y"]}},
            {"players": [self._shift_player(player, -0.8, 0.7) for player in players], "ball": {"x": 32.0, "y": 20.0}},
            {"players": [self._shift_player(player, 0.2, -0.9) for player in players], "ball": {"x": 35.5, "y": 21.0}},
            {"players": [self._shift_player(player, -0.6, 0.4) for player in players], "ball": {"x": 38.0, "y": 22.5}},
        ]

        play_by_play = [
            {"id": "play-1", "gameClock": "[01:42 Q4]", "type": "3-POINT ATTEMPT", "description": "Miller misses from the left wing."},
            {"id": "play-2", "gameClock": "[01:51 Q4]", "type": "REBOUND", "description": "Claxton secures the defensive rebound."},
            {"id": "play-3", "gameClock": "[02:04 Q4]", "type": "PERSONAL FOUL", "description": "Brooklyn called for a reach-in foul."},
            {"id": "play-4", "gameClock": "[02:18 Q4]", "type": "STEAL", "description": "Wash jumps the passing lane."},
            {"id": "play-5", "gameClock": "[02:32 Q4]", "type": "2-POINT MADE", "description": "King finishes through contact."},
        ]

        commentary = [
            {"id": "commentary-1", "gameClock": "[01:42 Q4]", "text": "Steel are slowing the floor and forcing Brooklyn to defend every possession."},
            {"id": "commentary-2", "gameClock": "[01:51 Q4]", "text": "That is textbook late-game execution from Chicago."},
            {"id": "commentary-3", "gameClock": "[02:04 Q4]", "text": "The next stop could decide the entire championship series."},
            {"id": "commentary-4", "gameClock": "[02:18 Q4]", "text": "The energy swing is entirely on the home side right now."},
        ]

        events = [
            {
                "id": "event-1",
                "sequence": 1,
                "occurredAt": datetime.now(UTC).isoformat(),
                "type": "snapshot",
                "gameClock": "[01:42 Q4]",
                "description": "Initial snapshot loaded.",
                "metadata": {"phase": "live"},
            },
            {
                "id": "event-2",
                "sequence": 2,
                "occurredAt": datetime.now(UTC).isoformat(),
                "type": "play_by_play",
                "gameClock": "[01:42 Q4]",
                "description": "Miller attempts a three from the wing.",
                "metadata": {"team": "home", "playType": "3-POINT ATTEMPT"},
            },
            {
                "id": "event-3",
                "sequence": 3,
                "occurredAt": datetime.now(UTC).isoformat(),
                "type": "commentary",
                "gameClock": "[01:51 Q4]",
                "description": "Late-game execution from the home side.",
                "metadata": {"team": "home"},
            },
            {
                "id": "event-4",
                "sequence": 4,
                "occurredAt": datetime.now(UTC).isoformat(),
                "type": "match_update",
                "gameClock": "[02:04 Q4]",
                "description": "Score and momentum updated.",
                "metadata": {"homeScore": home["score"], "awayScore": away["score"]},
            },
        ]

        narration = [
            {"eventId": "event-1", "locale": locale, "text": "Chicago leans on tempo and control as the quarter tightens."},
            {"eventId": "event-2", "locale": locale, "text": "Miller steps into a difficult look and searches for a clean finish."},
            {"eventId": "event-3", "locale": locale, "text": "The Steel keep the floor compressed and punish every defensive breakdown."},
            {"eventId": "event-4", "locale": locale, "text": "The momentum swings sharply and every possession matters."},
        ]

        return {
            "matchId": match_id,
            "matchMeta": "DIVISION A CHAMPIONSHIP SERIES · GAME 7",
            "ticker": f"COURT 01: CS LEAD {home['score']}-{away['score']} (Q4 01:42) // LIVE SIMULATION ACTIVE",
            "home": home,
            "away": away,
            "playCall": rng.choice(["HORNS CORNER SNAP", "HIGH PICK AND ROLL", "WEAK-SIDE CUT", "SPREAD MOTION"]),
            "shotProbability": rng.randint(55, 78),
            "defensiveScheme": rng.choice(["2-3 DROP ZONE", "SWITCH EVERYTHING", "MAN-TO-MAN PRESS", "PACKED PAINT"]),
            "quarter": 4,
            "gameClock": "01:42",
            "shotClock": "08",
            "elapsedSeconds": 864,
            "durationSeconds": 960,
            "momentum": {
                "runLabel": "2-MINUTE CLUTCH RUN",
                "runDelta": "+6 CHICAGO RUN",
                "homePoints": 6,
                "awayPoints": 0,
                "stats": [["FG%", "54.2"], ["PAINT PTS", "38"], ["FAST BREAK PTS", "12"]],
            },
            "frame": frame,
            "frames": frames,
            "playByPlay": play_by_play,
            "commentary": commentary,
            "events": events,
            "narration": narration,
        }

    @staticmethod
    def _shift_player(player: dict[str, Any], dx: float, dy: float) -> dict[str, Any]:
        """Shift a player by a small deterministic offset."""

        patched = dict(player)
        patched["x"] = round(player["x"] + dx, 2)
        patched["y"] = round(player["y"] + dy, 2)
        return patched
