"""Schema validation for the ingestion pipeline's output contract.

plan.md §2.1 designates `players.json` / `teams.json` as "the contract
between components," to be enforced by validators that are "the single
source of truth" for every downstream module. Previously that contract
existed only as a docstring: `derive.py` built dicts by hand and wrote them
straight to disk, so a malformed row (an out-of-range rate, a roster
pointing at a player that doesn't exist, a duplicate id) would only be
caught later, inside the engine or UI, far from where it was produced.

This module is that enforcement point. `derive.py` calls
`validate_processed_output()` on the in-memory data *before* writing
anything to disk, so:
  - a bad run fails loudly, with every problem listed at once, instead of
    silently overwriting last known-good output with corrupt data.
  - every failure is collected, not just the first, since a single bad
    upstream join usually produces many bad rows and seeing them all in one
    error is far more useful than one crash-fix-rerun cycle per row.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, ValidationError, field_validator

__all__ = [
    "SchemaValidationError",
    "Player",
    "PlayerAttributes",
    "Team",
    "TeamStats",
    "validate_players",
    "validate_teams",
    "validate_referential_integrity",
    "validate_processed_output",
]


class SchemaValidationError(RuntimeError):
    """One or more records failed schema or cross-reference validation."""


# ── players.json ─────────────────────────────────────────────────────────

# Every attribute in plan.md §2.1 is documented as a 0-1 rate/percentage.
UNIT_RATE = Field(ge=0.0, le=1.0)

VALID_POSITIONS = {"G", "F", "C", "G-F", "F-G", "F-C", "C-F", "X"}
VALID_POSITION5 = {"PG", "SG", "SF", "PF", "C", "X"}
_SLUG_RE = re.compile(r"[a-z0-9]+(?:_[a-z0-9]+)*")


class PlayerAttributes(BaseModel):
    """The 12 simulator attributes (plan.md §2.1)."""

    model_config = {"extra": "forbid"}

    two_pt_pct: float = UNIT_RATE
    three_pt_pct: float = UNIT_RATE
    ft_pct: float = UNIT_RATE
    turnover_rate: float = UNIT_RATE
    foul_rate: float = UNIT_RATE
    rebound_rate: float = UNIT_RATE
    assist_rate: float = UNIT_RATE
    steal_rate: float = UNIT_RATE
    block_rate: float = UNIT_RATE
    stamina: float = UNIT_RATE
    clutch_factor: float = UNIT_RATE
    usage_rate: float = UNIT_RATE


class Player(BaseModel):
    model_config = {"extra": "forbid"}

    player_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    team_id: str = Field(min_length=1)
    position: str
    position5: str
    is_starter: bool
    attributes: PlayerAttributes

    @field_validator("player_id", "team_id")
    @classmethod
    def _ascii_slug(cls, v: str) -> str:
        if not _SLUG_RE.fullmatch(v):
            raise ValueError(f"expected an ascii_slug (lowercase, underscore-separated), got {v!r}")
        return v

    @field_validator("position")
    @classmethod
    def _known_position(cls, v: str) -> str:
        if v not in VALID_POSITIONS:
            raise ValueError(f"unrecognized NBA position code {v!r} (expected one of {sorted(VALID_POSITIONS)})")
        return v

    @field_validator("position5")
    @classmethod
    def _known_position5(cls, v: str) -> str:
        if v not in VALID_POSITION5:
            raise ValueError(f"unrecognized classic position {v!r} (expected one of {sorted(VALID_POSITION5)})")
        return v


# ── teams.json ───────────────────────────────────────────────────────────

class TeamStats(BaseModel):
    model_config = {"extra": "forbid"}

    pace: float = Field(gt=0.0, description="possessions per 48 min; must be positive")
    off_rtg: float
    def_rtg: float


class Team(BaseModel):
    model_config = {"extra": "forbid"}

    team_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    abbreviation: str = Field(min_length=2, max_length=4)
    roster: list[str]
    team_stats: TeamStats
    season: str = Field(min_length=1)

    @field_validator("team_id")
    @classmethod
    def _ascii_slug(cls, v: str) -> str:
        if not _SLUG_RE.fullmatch(v):
            raise ValueError(f"expected an ascii_slug (lowercase, underscore-separated), got {v!r}")
        return v

    @field_validator("abbreviation")
    @classmethod
    def _upper_abbreviation(cls, v: str) -> str:
        if v != v.upper():
            raise ValueError(f"expected an uppercase abbreviation, got {v!r}")
        return v

    @field_validator("roster")
    @classmethod
    def _nonempty_unique_roster(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("roster must not be empty")
        if len(v) != len(set(v)):
            dupes = {pid for pid in v if v.count(pid) > 1}
            raise ValueError(f"roster contains duplicate player_id entries: {sorted(dupes)}")
        return v


# ── Validation entry points ──────────────────────────────────────────────

def validate_players(players_json: list[dict]) -> list[Player]:
    """Validate every player dict; raise once with *all* failures listed."""
    errors: list[str] = []
    validated: list[Player] = []
    seen_ids: set[str] = set()

    for i, raw in enumerate(players_json):
        label = raw.get("player_id", f"<row {i}, no player_id>")
        try:
            player = Player.model_validate(raw)
        except ValidationError as err:
            errors.append(f"player[{i}] ({label}): {err}")
            continue
        if player.player_id in seen_ids:
            errors.append(f"player[{i}] ({label}): duplicate player_id")
            continue
        seen_ids.add(player.player_id)
        validated.append(player)

    if errors:
        raise SchemaValidationError(
            f"{len(errors)} player record(s) in players.json failed validation "
            f"out of {len(players_json)}:\n" + "\n".join(errors)
        )
    return validated


def validate_teams(teams_json: list[dict]) -> list[Team]:
    """Validate every team dict; raise once with *all* failures listed."""
    errors: list[str] = []
    validated: list[Team] = []
    seen_ids: set[str] = set()

    for i, raw in enumerate(teams_json):
        label = raw.get("team_id", f"<row {i}, no team_id>")
        try:
            team = Team.model_validate(raw)
        except ValidationError as err:
            errors.append(f"team[{i}] ({label}): {err}")
            continue
        if team.team_id in seen_ids:
            errors.append(f"team[{i}] ({label}): duplicate team_id")
            continue
        seen_ids.add(team.team_id)
        validated.append(team)

    if errors:
        raise SchemaValidationError(
            f"{len(errors)} team record(s) in teams.json failed validation "
            f"out of {len(teams_json)}:\n" + "\n".join(errors)
        )
    return validated


def validate_referential_integrity(players: list[Player], teams: list[Team]) -> None:
    """Cross-table checks a single model can't express on its own:

    - every player.team_id must name a real team
    - every team.roster entry must name a real player
    - a player and its team's roster must agree on membership both ways
    """
    errors: list[str] = []

    team_ids = {t.team_id for t in teams}
    player_ids = {p.player_id for p in players}
    players_by_team: dict[str, set[str]] = {}
    for p in players:
        players_by_team.setdefault(p.team_id, set()).add(p.player_id)

    for p in players:
        if p.team_id not in team_ids:
            errors.append(f"player {p.player_id!r} has team_id {p.team_id!r}, which is not in teams.json")

    for t in teams:
        roster_set = set(t.roster)
        for pid in t.roster:
            if pid not in player_ids:
                errors.append(f"team {t.team_id!r} roster references unknown player_id {pid!r}")
        missing_from_roster = players_by_team.get(t.team_id, set()) - roster_set
        for pid in sorted(missing_from_roster):
            errors.append(
                f"player {pid!r} has team_id {t.team_id!r} but does not appear in that team's roster"
            )

    if errors:
        raise SchemaValidationError(
            f"{len(errors)} referential integrity issue(s) between players.json and teams.json:\n"
            + "\n".join(errors)
        )


def validate_processed_output(
    players_json: list[dict], teams_json: list[dict]
) -> tuple[list[Player], list[Team]]:
    """Full contract check for derive.py's output, run before anything is written to disk."""
    players = validate_players(players_json)
    teams = validate_teams(teams_json)
    validate_referential_integrity(players, teams)
    return players, teams