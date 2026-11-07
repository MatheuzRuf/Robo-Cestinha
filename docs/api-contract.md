# Simulation API contract

## Endpoint

`POST /matches/{match_id}/simulation`

Request body:

```json
{
  "sessionHash": "RC-1234",
  "iterations": 1000
}
```

## Response

The response contains `match`, `simulation`, `teams`, `players`, `frames`,
`events`, and `summary`.

Each frame contains its iteration, current ball handler, player positions, ball
position, score, and possession team. When `playerWithBallId` is set, the ball
coordinates match that player's position. While the ball is moving, the handler
is `null` and the ball includes an explicit pass or shot trajectory and progress.

Each event includes a sequence number, frame iteration, type, team, optional
player and target player IDs, and event-specific data. The frontend uses these
events and frames for synchronized playback.
