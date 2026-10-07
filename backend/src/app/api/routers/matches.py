import asyncio
import json
import random
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

router = APIRouter()

FRAME_INTERVAL_SECONDS = 0.8
MATCH_UPDATE_INTERVAL_TICKS = 5
LOG_UPDATE_INTERVAL_TICKS = 15
COURT_WIDTH = 94
COURT_HEIGHT = 50

HOME_ROSTER = [
    ("Miller", 7, "PG"),
    ("Walker", 33, "PF"),
    ("King", 55, "C"),
    ("Wash", 24, "SF"),
    ("Johnson", 11, "PF"),
]
AWAY_ROSTER = [
    ("Dinwiddie", 8, "PG"),
    ("Bridges", 1, "SG"),
    ("Claxton", 33, "C"),
    ("Finney", 10, "SF"),
    ("Vance", 4, "SG"),
]

PLAY_TEMPLATES = [
    ("3-POINT ATTEMPT", "{player} misses from the left wing."),
    ("REBOUND", "{player} secures the defensive rebound."),
    ("PERSONAL FOUL", "{team} called for a reach-in foul."),
    ("STEAL", "{player} jumps the passing lane."),
    ("2-POINT MADE", "{player} finishes through contact."),
    ("TURNOVER", "{team} loses the ball under pressure."),
]

COMMENTARY_TEMPLATES = [
    "{team} are slowing the floor and forcing the defense to work.",
    "That is late-game execution from {team}.",
    "The next stop could change the momentum of this game.",
    "Both sides are trading possessions in a tight finish.",
]

PLAY_CALLS = [
    "HORNS CORNER SNAP",
    "HIGH PICK AND ROLL",
    "WEAK-SIDE CUT",
    "SPREAD MOTION",
]
DEFENSIVE_SCHEMES = [
    "2-3 DROP ZONE",
    "SWITCH EVERYTHING",
    "MAN-TO-MAN PRESS",
    "PACKED PAINT",
]


def _make_players() -> list[dict[str, Any]]:
    players = []
    for team, roster, start_x in (
        ("home", HOME_ROSTER, 20),
        ("away", AWAY_ROSTER, 60),
    ):
        for index, (name, number, position) in enumerate(roster):
            players.append(
                {
                    "id": f"{team}-{index}",
                    "team": team,
                    "x": start_x + index * 5,
                    "y": 10 + index * 8,
                    "name": name,
                    "number": number,
                    "position": position,
                }
            )
    return players


def _ball_position(player: dict[str, Any]) -> dict[str, float]:
    return {"x": player["x"] + 2.5, "y": player["y"]}


def _clock_text(elapsed_seconds: int) -> tuple[int, str]:
    quarter = min(elapsed_seconds // 240 + 1, 4)
    remaining = max(0, 240 - elapsed_seconds % 240)
    return quarter, f"{remaining // 60:02d}:{remaining % 60:02d}"


def _make_team(
    abbreviation: str,
    name: str,
    seed: int,
    score: int,
    possession: bool,
    fouls: int,
    timeouts: int,
) -> dict[str, Any]:
    return {
        "abbreviation": abbreviation,
        "name": name,
        "score": score,
        "seed": f"SEED #{seed}",
        "possession": possession,
        "fouls": {"current": fouls, "max": 5},
        "timeouts": {"remaining": timeouts, "total": 3},
    }


def _make_snapshot(state: dict[str, Any]) -> dict[str, Any]:
    quarter, game_clock = _clock_text(state["elapsedSeconds"])
    home = state["home"]
    away = state["away"]
    leader = home if home["score"] >= away["score"] else away
    ticker = (
        f"COURT 01: {leader['abbreviation']} LEAD "
        f"{home['score']}-{away['score']} (Q{quarter} {game_clock}) // LIVE SIMULATION ACTIVE"
    )
    return {
        "matchId": state["matchId"],
        "matchMeta": "DIVISION A CHAMPIONSHIP SERIES · GAME 7",
        "ticker": ticker,
        "home": home,
        "away": away,
        "playCall": state["playCall"],
        "shotProbability": state["shotProbability"],
        "defensiveScheme": state["defensiveScheme"],
        "quarter": quarter,
        "gameClock": game_clock,
        "shotClock": f"{state['shotClock']:02d}",
        "elapsedSeconds": state["elapsedSeconds"],
        "durationSeconds": 960,
        "momentum": state["momentum"],
        "frame": {
            "players": state["players"],
            "ball": state["lastBallPosition"],
        },
        "playByPlay": state["playByPlay"],
        "commentary": state["commentary"],
    }


def _make_state(match_id: str, rng: random.Random) -> dict[str, Any]:
    players = _make_players()
    owner = players[0]
    home = _make_team("CS", "CHICAGO STEEL", 1, rng.randint(84, 88), True, 3, 1)
    away = _make_team("BB", "BROOKLYN BREAKERS", 2, rng.randint(78, 82), False, 4, 2)
    return {
        "matchId": match_id,
        "players": players,
        "ownerId": owner["id"],
        "lastBallPosition": _ball_position(owner),
        "elapsedSeconds": 864,
        "shotClock": 8,
        "home": home,
        "away": away,
        "playCall": rng.choice(PLAY_CALLS),
        "shotProbability": rng.randint(55, 78),
        "defensiveScheme": rng.choice(DEFENSIVE_SCHEMES),
        "momentum": {
            "runLabel": "2-MINUTE CLUTCH RUN",
            "runDelta": "+6 CHICAGO RUN",
            "homePoints": 6,
            "awayPoints": 0,
            "stats": [["FG%", "54.2"], ["PAINT PTS", "38"], ["FAST BREAK PTS", "12"]],
        },
        "playByPlay": [
            {
                "id": "play-1",
                "gameClock": "[01:42 Q4]",
                "type": "3-POINT ATTEMPT",
                "description": "M. Carter misses from the left wing.",
            },
            {
                "id": "play-2",
                "gameClock": "[01:51 Q4]",
                "type": "REBOUND",
                "description": "J. Brooks secures the defensive rebound.",
            },
            {
                "id": "play-3",
                "gameClock": "[02:04 Q4]",
                "type": "PERSONAL FOUL",
                "description": "Brooklyn called for a reach-in foul.",
            },
            {
                "id": "play-4",
                "gameClock": "[02:18 Q4]",
                "type": "STEAL",
                "description": "R. Ellis jumps the passing lane.",
            },
            {
                "id": "play-5",
                "gameClock": "[02:32 Q4]",
                "type": "2-POINT MADE",
                "description": "A. Reed finishes through contact.",
            },
        ],
        "commentary": [
            {
                "id": "commentary-1",
                "gameClock": "[01:42 Q4]",
                "text": "Steel are slowing the floor and forcing Brooklyn to defend every possession.",
            },
            {
                "id": "commentary-2",
                "gameClock": "[01:51 Q4]",
                "text": "That is textbook late-game execution from Chicago.",
            },
            {
                "id": "commentary-3",
                "gameClock": "[02:04 Q4]",
                "text": "The next stop could decide the entire championship series.",
            },
        ],
    }


def _format_event(sequence: int, event_type: str, payload: dict[str, Any]) -> str:
    event = {
        "sequence": sequence,
        "occurredAt": datetime.now(UTC).isoformat(),
        "type": event_type,
        "payload": payload,
    }
    return f"id: {sequence}\ndata: {json.dumps(event, separators=(',', ':'))}\n\n"


def _advance_frame(state: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    players = state["players"]
    for player in players:
        player["x"] = max(0, min(COURT_WIDTH, player["x"] + rng.uniform(-4, 4)))
        player["y"] = max(0, min(COURT_HEIGHT, player["y"] + rng.uniform(-4, 4)))

    owner = next(player for player in players if player["id"] == state["ownerId"])
    trajectory = None
    if rng.random() < 0.35:
        candidates = [player for player in players if player["id"] != owner["id"]]
        next_owner = rng.choice(candidates)
        ball = _ball_position(next_owner)
        trajectory = {
            "type": "pass",
            "from": state["lastBallPosition"],
            "to": ball,
            "fromTeam": owner["team"],
            "toTeam": next_owner["team"],
        }
        state["ownerId"] = next_owner["id"]
    else:
        ball = _ball_position(owner)

    state["lastBallPosition"] = ball
    frame = {"players": [player.copy() for player in players], "ball": ball}
    if trajectory:
        frame["trajectory"] = trajectory
    return frame


def _advance_match(state: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    state["elapsedSeconds"] += rng.randint(1, 3)
    if state["elapsedSeconds"] >= 960:
        state["elapsedSeconds"] = 0
        state["home"]["score"] = rng.randint(0, 8)
        state["away"]["score"] = rng.randint(0, 8)

    state["shotClock"] -= 1
    if state["shotClock"] <= 0:
        state["shotClock"] = 24
        state["home"]["possession"], state["away"]["possession"] = (
            state["away"]["possession"],
            state["home"]["possession"],
        )
        new_team = "home" if state["home"]["possession"] else "away"
        state["ownerId"] = next(
            player["id"] for player in state["players"] if player["team"] == new_team
        )

    if rng.random() < 0.18:
        team = rng.choice([state["home"], state["away"]])
        team["score"] += rng.choice([1, 2, 3])
        state["home"]["possession"] = team is state["away"]
        state["away"]["possession"] = team is state["home"]
        new_team = "home" if team is state["away"] else "away"
        state["ownerId"] = next(
            player["id"] for player in state["players"] if player["team"] == new_team
        )

    if rng.random() < 0.12:
        state[rng.choice(["home", "away"])]["fouls"]["current"] = rng.randint(0, 5)

    state["playCall"] = rng.choice(PLAY_CALLS)
    state["shotProbability"] = rng.randint(35, 82)
    state["defensiveScheme"] = rng.choice(DEFENSIVE_SCHEMES)
    state["momentum"]["homePoints"] = rng.randint(0, 10)
    state["momentum"]["awayPoints"] = rng.randint(0, 10)
    run_team = (
        state["home"]
        if state["momentum"]["homePoints"] >= state["momentum"]["awayPoints"]
        else state["away"]
    )
    state["momentum"]["runDelta"] = (
        f"+{abs(state['momentum']['homePoints'] - state['momentum']['awayPoints'])} {run_team['abbreviation']} RUN"
    )
    state["momentum"]["stats"] = [
        ["FG%", f"{rng.uniform(35, 60):.1f}"],
        ["PAINT PTS", str(rng.randint(18, 48))],
        ["FAST BREAK PTS", str(rng.randint(4, 20))],
    ]
    snapshot = _make_snapshot(state)
    return {
        key: snapshot[key]
        for key in (
            "ticker",
            "home",
            "away",
            "playCall",
            "shotProbability",
            "defensiveScheme",
            "quarter",
            "gameClock",
            "shotClock",
            "elapsedSeconds",
            "momentum",
        )
    }


def _make_feed_entries(
    state: dict[str, Any], rng: random.Random, sequence: int
) -> tuple[dict[str, str], dict[str, str]]:
    quarter, game_clock = _clock_text(state["elapsedSeconds"])
    player = rng.choice(state["players"])
    team = rng.choice([state["home"], state["away"]])
    play_type, play_description = rng.choice(PLAY_TEMPLATES)
    play_entry = {
        "id": f"play-{sequence}",
        "gameClock": f"[{game_clock} Q{quarter}]",
        "type": play_type,
        "description": play_description.format(
            player=player["name"], team=team["name"]
        ),
    }
    commentary_entry = {
        "id": f"commentary-{sequence}",
        "gameClock": f"[{game_clock} Q{quarter}]",
        "text": rng.choice(COMMENTARY_TEMPLATES).format(team=team["name"]),
    }
    return play_entry, commentary_entry


async def _generate_events(match_id: str) -> AsyncIterator[str]:
    rng = random.Random()
    state = _make_state(match_id, rng)
    sequence = 0

    sequence += 1
    yield _format_event(sequence, "snapshot", _make_snapshot(state))

    tick = 0
    while True:
        await asyncio.sleep(FRAME_INTERVAL_SECONDS)
        tick += 1

        sequence += 1
        yield _format_event(sequence, "frame", _advance_frame(state, rng))

        if tick % MATCH_UPDATE_INTERVAL_TICKS == 0:
            sequence += 1
            yield _format_event(sequence, "match_update", _advance_match(state, rng))

        if tick % LOG_UPDATE_INTERVAL_TICKS == 0:
            play_entry, commentary_entry = _make_feed_entries(state, rng, sequence + 1)
            state["playByPlay"].append(play_entry)
            state["commentary"].append(commentary_entry)
            state["playByPlay"] = state["playByPlay"][-50:]
            state["commentary"] = state["commentary"][-50:]

            sequence += 1
            yield _format_event(sequence, "play_by_play", play_entry)
            sequence += 1
            yield _format_event(sequence, "commentary", commentary_entry)


@router.get("/stream")
async def stream_match(
    match_id: str = Query(default="demo", min_length=1),
) -> StreamingResponse:
    """Stream randomized demo events for the requested match.

    Args:
        match_id: Identifier included in the initial match snapshot.

    Returns:
        An SSE response containing mock match events.
    """

    return StreamingResponse(
        _generate_events(match_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
