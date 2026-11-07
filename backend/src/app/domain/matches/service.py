"""Domain service that builds seeded mock match simulations."""

from __future__ import annotations

import random
from typing import Any, ClassVar


class MockSimulationService:
    """Generate a reproducible mock simulation with possession-aware ball movement."""

    HOME_TEAM_ID = "home-team-demo"
    AWAY_TEAM_ID = "away-team-demo"
    HOME_ROSTER: ClassVar[list[tuple[str, str, str, int]]] = [
        ("home-pg", "Alex Reed", "PG", 4),
        ("home-sg", "Jamie Cole", "SG", 12),
        ("home-sf", "Morgan Lee", "SF", 22),
        ("home-pf", "Riley Gray", "PF", 31),
        ("home-c", "Casey Park", "C", 50),
    ]
    AWAY_ROSTER: ClassVar[list[tuple[str, str, str, int]]] = [
        ("away-pg", "Taylor Fox", "PG", 3),
        ("away-sg", "Jordan Bell", "SG", 11),
        ("away-sf", "Cameron West", "SF", 20),
        ("away-pf", "Drew North", "PF", 33),
        ("away-c", "Avery Stone", "C", 44),
    ]
    COURT_WIDTH = 94.0
    HOOP_X = 5.25
    HOOP_RIGHT_X = COURT_WIDTH - HOOP_X
    MAX_DEMO_FRAMES = 72

    def run_simulation(
        self, match_id: str, session_hash: str, iterations: int
    ) -> dict[str, Any]:
        """Generate a seeded simulation payload for the requested match.

        Args:
            match_id: Match identifier used to seed the mock sequence.
            session_hash: Session identifier used to vary the mock sequence.
            iterations: Maximum number of frame transitions to generate.

        Returns:
            Match metadata, player roster, frames, events, and final score.
        """

        rng = random.Random(f"{match_id}:{session_hash}")
        teams = {
            "home": {
                "teamId": self.HOME_TEAM_ID,
                "name": "Harbor Hawks",
                "abbreviation": "HH",
            },
            "away": {
                "teamId": self.AWAY_TEAM_ID,
                "name": "Mountain Bears",
                "abbreviation": "MB",
            },
        }
        players = [
            {
                "playerId": player_id,
                "teamId": team_id,
                "side": side,
                "name": name,
                "position": position,
                "number": number,
            }
            for side, team_id, roster in (
                ("home", self.HOME_TEAM_ID, self.HOME_ROSTER),
                ("away", self.AWAY_TEAM_ID, self.AWAY_ROSTER),
            )
            for player_id, name, position, number in roster
        ]
        player_team_ids = {player["playerId"]: player["teamId"] for player in players}
        scores = {self.HOME_TEAM_ID: 0, self.AWAY_TEAM_ID: 0}
        frames: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = []
        frame_limit = min(iterations + 1, self.MAX_DEMO_FRAMES)
        possession_team_id = self.HOME_TEAM_ID
        holder_id = "home-pg"
        start_position = {"x": 47.0, "y": 25.0}
        positions = self._make_positions(
            players, possession_team_id, holder_id, start_position, rng
        )
        self._append_frame(
            frames,
            players,
            positions,
            holder_id,
            possession_team_id,
            scores,
        )
        self._append_event(
            events,
            frames,
            "game_started",
            possession_team_id,
            holder_id,
            None,
            {},
        )

        previous_shot_missed = False
        for play_index in range(5):
            minimum_frames = 9 + (1 if play_index > 0 else 0)
            if len(frames) + minimum_frames > frame_limit:
                break

            if play_index > 0:
                possession_team_id = (
                    self.AWAY_TEAM_ID
                    if possession_team_id == self.HOME_TEAM_ID
                    else self.HOME_TEAM_ID
                )
                side = "home" if possession_team_id == self.HOME_TEAM_ID else "away"
                roster = self.HOME_ROSTER if side == "home" else self.AWAY_ROSTER
                holder_id = rng.choice(roster)[0]
                start_position = dict(frames[-1]["ball"])
                positions = self._make_positions(
                    players, possession_team_id, holder_id, start_position, rng
                )
                self._append_frame(
                    frames,
                    players,
                    positions,
                    holder_id,
                    possession_team_id,
                    scores,
                )
                self._append_event(
                    events,
                    frames,
                    "rebound" if previous_shot_missed else "possession_started",
                    possession_team_id,
                    holder_id,
                    None,
                    {},
                )

            side = "home" if possession_team_id == self.HOME_TEAM_ID else "away"
            direction = 1.0 if side == "home" else -1.0
            for _ in range(2):
                current = positions[holder_id]
                positions[holder_id] = {
                    "x": self._clamp(
                        current["x"] + direction * rng.uniform(2.0, 3.5), 2.0, 92.0
                    ),
                    "y": self._clamp(current["y"] + rng.uniform(-2.0, 2.0), 7.0, 43.0),
                }
                self._append_frame(
                    frames,
                    players,
                    positions,
                    holder_id,
                    possession_team_id,
                    scores,
                )
                self._append_event(
                    events,
                    frames,
                    "dribble",
                    possession_team_id,
                    holder_id,
                    None,
                    {},
                )

            if rng.random() < 0.78 and len(frames) + 11 <= frame_limit:
                teammates = [
                    player_id
                    for player_id, team_id in player_team_ids.items()
                    if team_id == possession_team_id and player_id != holder_id
                ]
                receiver_id = rng.choice(teammates)
                source = dict(positions[holder_id])
                current_receiver = positions[receiver_id]
                target = {
                    "x": self._clamp(
                        source["x"] + direction * rng.uniform(4.0, 8.0), 2.0, 92.0
                    ),
                    "y": self._clamp(
                        current_receiver["y"] + rng.uniform(-4.0, 4.0), 7.0, 43.0
                    ),
                }
                positions[receiver_id] = target
                trajectory = self._make_trajectory(
                    "pass",
                    source,
                    target,
                    holder_id,
                    receiver_id,
                    possession_team_id,
                    possession_team_id,
                )
                for step in range(1, 4):
                    progress = step / 4
                    ball = self._interpolate(source, target, progress)
                    ball["height"] = round(0.25 * 4 * progress * (1 - progress), 3)
                    self._append_frame(
                        frames,
                        players,
                        positions,
                        None,
                        possession_team_id,
                        scores,
                        ball,
                        {**trajectory, "progress": progress},
                    )
                holder_id = receiver_id
                self._append_frame(
                    frames,
                    players,
                    positions,
                    holder_id,
                    possession_team_id,
                    scores,
                )
                self._append_event(
                    events,
                    frames,
                    "pass_completed",
                    possession_team_id,
                    trajectory["fromPlayerId"],
                    receiver_id,
                    {},
                )

            hoop_x = self.HOOP_RIGHT_X if side == "home" else self.HOOP_X
            distance = rng.uniform(16.0, 27.0)
            shooter_position = {
                "x": self._clamp(hoop_x - direction * distance, 3.0, 91.0),
                "y": rng.uniform(14.0, 36.0),
            }
            positions[holder_id] = shooter_position
            self._append_frame(
                frames,
                players,
                positions,
                holder_id,
                possession_team_id,
                scores,
            )
            shot_value = (
                3
                if (
                    (hoop_x - shooter_position["x"]) ** 2
                    + (25.0 - shooter_position["y"]) ** 2
                )
                ** 0.5
                >= 23.75
                else 2
            )
            self._append_event(
                events,
                frames,
                "shot_attempted",
                possession_team_id,
                holder_id,
                None,
                {"shotValue": shot_value},
            )

            source = dict(shooter_position)
            basket = {"x": hoop_x, "y": 25.0}
            trajectory = self._make_trajectory(
                "shot",
                source,
                basket,
                holder_id,
                None,
                possession_team_id,
                possession_team_id,
            )
            is_made = play_index == 0 or (play_index != 1 and rng.random() < 0.5)
            for step in range(1, 7):
                progress = step / 6
                ball = self._interpolate(source, basket, progress)
                ball["height"] = round(3.2 * 4 * progress * (1 - progress), 3)
                if step == 6:
                    ball["height"] = 0.0
                    if is_made:
                        scores[possession_team_id] += shot_value
                self._append_frame(
                    frames,
                    players,
                    positions,
                    None,
                    possession_team_id,
                    scores,
                    ball,
                    {**trajectory, "progress": progress},
                )

            previous_shot_missed = not is_made
            if is_made:
                self._append_event(
                    events,
                    frames,
                    "shot_made",
                    possession_team_id,
                    holder_id,
                    None,
                    {
                        "pointsScored": shot_value,
                        "scoreAfter": {
                            "home": scores[self.HOME_TEAM_ID],
                            "away": scores[self.AWAY_TEAM_ID],
                        },
                    },
                )
            else:
                self._append_event(
                    events,
                    frames,
                    "shot_missed",
                    possession_team_id,
                    holder_id,
                    None,
                    {"shotValue": shot_value},
                )

        home_score = scores[self.HOME_TEAM_ID]
        away_score = scores[self.AWAY_TEAM_ID]
        winner_team_id = (
            self.HOME_TEAM_ID
            if home_score > away_score
            else self.AWAY_TEAM_ID
            if away_score > home_score
            else None
        )
        return {
            "match": {
                "matchId": match_id,
                "sessionHash": session_hash,
                "status": "finished",
            },
            "simulation": {
                "status": "completed",
                "iterationsLimit": iterations,
                "iterationsCompleted": max(0, len(frames) - 1),
                "overtimeIterations": 0,
                "terminationReason": (
                    "iteration_limit"
                    if len(frames) - 1 >= iterations
                    else "demo_sequence_complete"
                ),
            },
            "teams": teams,
            "players": players,
            "frames": frames,
            "events": events,
            "summary": {
                "homeScore": home_score,
                "awayScore": away_score,
                "winnerTeamId": winner_team_id,
            },
        }

    @classmethod
    def _make_positions(
        cls,
        players: list[dict[str, Any]],
        offense_team_id: str,
        holder_id: str,
        start: dict[str, float],
        rng: random.Random,
    ) -> dict[str, dict[str, float]]:
        """Place both teams around a defined ball-handler position."""

        direction = 1.0 if offense_team_id == cls.HOME_TEAM_ID else -1.0
        positions: dict[str, dict[str, float]] = {}
        offense_slot = 0
        defense_slot = 0
        for player in players:
            player_id = player["playerId"]
            if player_id == holder_id:
                positions[player_id] = dict(start)
                continue
            if player["teamId"] == offense_team_id:
                offense_slot += 1
                offset = 4.0 + offense_slot * 2.2
                y = (8.0, 42.0, 16.0, 34.0)[(offense_slot - 1) % 4]
            else:
                defense_slot += 1
                offset = 5.0 + defense_slot * 2.0
                y = (12.0, 38.0, 20.0, 30.0)[(defense_slot - 1) % 4]
            positions[player_id] = {
                "x": cls._clamp(start["x"] - direction * offset, 2.0, 92.0),
                "y": cls._clamp(y + rng.uniform(-1.5, 1.5), 4.0, 46.0),
            }
        return positions

    @classmethod
    def _append_frame(
        cls,
        frames: list[dict[str, Any]],
        players: list[dict[str, Any]],
        positions: dict[str, dict[str, float]],
        holder_id: str | None,
        possession_team_id: str,
        scores: dict[str, int],
        ball: dict[str, float] | None = None,
        trajectory: dict[str, Any] | None = None,
    ) -> None:
        """Append a frame with the ball attached to its holder or trajectory."""

        if holder_id is not None:
            ball_position = dict(positions[holder_id])
            ball_position["height"] = 0.0
        else:
            ball_position = dict(ball or {})
        frames.append(
            {
                "iteration": len(frames),
                "playerWithBallId": holder_id,
                "players": [
                    {
                        "playerId": player["playerId"],
                        "x": round(positions[player["playerId"]]["x"], 3),
                        "y": round(positions[player["playerId"]]["y"], 3),
                    }
                    for player in players
                ],
                "ball": {
                    "x": round(ball_position["x"], 3),
                    "y": round(ball_position["y"], 3),
                    "height": round(ball_position.get("height", 0.0), 3),
                    "trajectory": trajectory,
                },
                "score": {
                    "home": scores[cls.HOME_TEAM_ID],
                    "away": scores[cls.AWAY_TEAM_ID],
                },
                "possessionTeamId": possession_team_id,
            }
        )

    @staticmethod
    def _append_event(
        events: list[dict[str, Any]],
        frames: list[dict[str, Any]],
        event_type: str,
        team_id: str,
        player_id: str | None,
        target_player_id: str | None,
        data: dict[str, Any],
    ) -> None:
        """Append an event associated with the most recently generated frame."""

        events.append(
            {
                "sequence": len(events) + 1,
                "iteration": frames[-1]["iteration"],
                "type": event_type,
                "teamId": team_id,
                "playerId": player_id,
                "targetPlayerId": target_player_id,
                "data": data,
            }
        )

    @staticmethod
    def _make_trajectory(
        trajectory_type: str,
        source: dict[str, float],
        target: dict[str, float],
        source_player_id: str | None,
        target_player_id: str | None,
        source_team_id: str,
        target_team_id: str,
    ) -> dict[str, Any]:
        """Build metadata for an explicit pass or shot path."""

        return {
            "type": trajectory_type,
            "fromPosition": {"x": round(source["x"], 3), "y": round(source["y"], 3)},
            "toPosition": {"x": round(target["x"], 3), "y": round(target["y"], 3)},
            "fromPlayerId": source_player_id,
            "toPlayerId": target_player_id,
            "fromTeamId": source_team_id,
            "toTeamId": target_team_id,
        }

    @staticmethod
    def _interpolate(
        source: dict[str, float], target: dict[str, float], progress: float
    ) -> dict[str, float]:
        """Return a point along a path between two court positions."""

        return {
            "x": round(source["x"] + (target["x"] - source["x"]) * progress, 3),
            "y": round(source["y"] + (target["y"] - source["y"]) * progress, 3),
        }

    @staticmethod
    def _clamp(value: float, lower: float, upper: float) -> float:
        """Keep a generated court coordinate within the court bounds."""

        return max(lower, min(upper, value))
