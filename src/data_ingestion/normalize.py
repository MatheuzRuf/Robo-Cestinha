"""Small normalization / formula helpers shared by the pipeline."""

import re
import unicodedata

import pandas as pd

from . import config


# ── Text normalization ──────────────────────────────────────────────────────

def ascii_slug(value: str) -> str:
    """Normalize a player slug to plain ascii with underscores.

    'lebron-james' -> 'lebron_james'
    'kristaps-porziņģis' -> 'kristaps-porzingis'
    """
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


# ── Numeric helpers ─────────────────────────────────────────────────────────


def parse_height_inches(height) -> float | None:
    """Parse the NBA '6-9' format into inches (81.0). None if unknown."""
    if height is None or pd.isna(height):
        return None
    text = str(height).strip().replace('"', "").replace("'", "-")
    parts = re.split(r"[- ]", text)
    try:
        feet = float(parts[0])
        inches = float(parts[1]) if len(parts) > 1 and parts[1] else 0.0
        return feet * 12 + inches
    except (ValueError, IndexError):
        return None


def safe_div(numerator, denominator, default: float = 0.0) -> float:
    if denominator and denominator > 0:
        return float(numerator) / float(denominator)
    return default


def league_possessions_per_game(player_totals: pd.DataFrame, team_games: int) -> float:
    """One team's ball possessions per game, league-wide.

    Summing (FGA + .44*FTA + TOV) over all players counts each team's
    possessions exactly once per game; divide by the true number of team-games
    (from team stats), NOT by player-games.
    """
    total_poss = float(
        (player_totals["FGA"]
         + config.FTA_POSSESSION_FACTOR * player_totals["FTA"]
         + player_totals["TOV"]).sum()
    )
    return safe_div(total_poss, team_games, default=100.0)