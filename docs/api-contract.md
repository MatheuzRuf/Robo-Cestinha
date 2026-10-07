# Timeline API contract

This document describes the backend/frontend contract for the match broadcast timeline used by the mock transport layer.

## Endpoint

- GET /matches/{match_id}/timeline
- Optional query parameter: locale (default: en-US)

## Response shape

```json
{
  "matchId": "demo",
  "matchMeta": "DIVISION A CHAMPIONSHIP SERIES · GAME 7",
  "ticker": "COURT 01: CS LEAD 84-81 (Q4 01:42) // LIVE SIMULATION ACTIVE",
  "home": {
    "abbreviation": "CS",
    "name": "CHICAGO STEEL",
    "score": 84,
    "seed": "SEED #1",
    "possession": true,
    "fouls": { "current": 3, "max": 5 },
    "timeouts": { "remaining": 1, "total": 3 }
  },
  "away": {
    "abbreviation": "BB",
    "name": "BROOKLYN BREAKERS",
    "score": 81,
    "seed": "SEED #2",
    "possession": false,
    "fouls": { "current": 4, "max": 5 },
    "timeouts": { "remaining": 2, "total": 3 }
  },
  "playCall": "HIGH PICK AND ROLL",
  "shotProbability": 68,
  "defensiveScheme": "2-3 DROP ZONE",
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
    "stats": [["FG%", "54.2"], ["PAINT PTS", "38"], ["FAST BREAK PTS", "12"]]
  },
  "frame": {
    "players": [
      { "id": "home-0", "team": "home", "x": 18.0, "y": 12.0, "name": "Miller", "number": 7, "position": "PG" }
    ],
    "ball": { "x": 30.5, "y": 19.5 }
  },
  "frames": [
    {
      "players": [
        { "id": "home-0", "team": "home", "x": 18.0, "y": 12.0, "name": "Miller", "number": 7, "position": "PG" }
      ],
      "ball": { "x": 30.5, "y": 19.5 }
    }
  ],
  "playByPlay": [
    {
      "id": "play-1",
      "gameClock": "[01:42 Q4]",
      "type": "3-POINT ATTEMPT",
      "description": "Miller misses from the left wing."
    }
  ],
  "commentary": [
    {
      "id": "commentary-1",
      "gameClock": "[01:42 Q4]",
      "text": "Steel are slowing the floor and forcing Brooklyn to defend every possession."
    }
  ],
  "events": [
    {
      "id": "event-1",
      "sequence": 1,
      "occurredAt": "2026-10-07T...Z",
      "type": "snapshot",
      "gameClock": "[01:42 Q4]",
      "description": "Initial snapshot loaded.",
      "metadata": { "phase": "live" }
    }
  ],
  "narration": [
    {
      "eventId": "event-1",
      "locale": "en-US",
      "text": "Chicago leans on tempo and control as the quarter tightens."
    }
  ]
}
```

## Notes

- `frame` is the current render frame used by the court animation.
- `frames` is the preloaded sequence used for local playback when API mode is active.
- `events` and `narration` are kept in the payload for later narration and replay features.
- `narration` is intentionally optional in the transport layer and will be populated in the next phase.

## Mock mode vs API mode

- Mock mode: the frontend keeps using the existing mock stream path.
- API mode: VITE_USE_API_TIMELINE=true and the frontend calls GET /matches/{match_id}/timeline once before playback begins.
