"""Configuration for the NBA 2025-26 data ingestion pipeline.

All tunables live here so formula experimentation never touches the network
(see docs/statistics.md).
"""

from pathlib import Path

# ── Season ──────────────────────────────────────────────────────────────────
SEASON = "2025-26"          # NBA season id (forward slash form for nba_api)
SEASON_TYPE = "Regular Season"

# ── Paths ───────────────────────────────────────────────────────────────────

def _repo_root() -> Path:
    """Locate the repo root: the ancestor holding both pyproject.toml and data/.

    This module lives at backend/src/app/data_ingestion/ while the raw/processed
    data directories live at the repo root, so a fixed parents[] offset is
    brittle. Requiring both markers keeps the search unambiguous even if a
    nested pyproject.toml is added later (e.g. backend/).
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").is_file() and (parent / "data").is_dir():
            return parent
    raise RuntimeError(
        "cannot locate repo root: no ancestor of "
        f"{here} contains both pyproject.toml and a data/ directory"
    )

ROOT = _repo_root()
RAW_DIR = ROOT / "data" / "raw" / SEASON.replace("-", "_")
ROSTER_DIR = RAW_DIR / "rosters"
PROCESSED_DIR = ROOT / "data" / "processed"

# ── Network / throttling ────────────────────────────────────────────────────
SECONDS_BETWEEN_CALLS = 0.7   # polite throttle for stats.nba.com
RETRIES = 4                   # attempts per call (429/504/timeouts)
BACKOFF_BASE_S = 2.0          # exponential backoff between retries
TIMEOUT_S = 30

# ── Derivation tunables ─────────────────────────────────────────────────────
SHRINKAGE_K = 10.0            # pseudo-attempts pulled toward league mean (0 = off)
CLUTCH_SPREAD = 2.0           # sensitivity of clutch_factor to clutch FG% delta
STAMINA_BASE = 0.55           # stamina floor for a zero-minute player
STAMINA_RANGE = 0.45          # additional stamina up to min_pg = STAMINA_MIN_PG
STAMINA_MIN_PG = 38.0         # minutes/game that saturates the stamina bonus
STAMINA_AGE_PENALTY = 0.05    # × ((age − 34) / 10), i.e. 0.005 per year above 34, capped (see statistics.md §6)
STAMINA_AGE_KNEE = 34.0

# Guards
MIN_GP_FOR_SAMPLE_FLAG = 10   # below this, player is flagged small-sample
FTA_POSSESSION_FACTOR = 0.44  # standard NBA possession estimator for free throws

# ── Basketball-Reference positions (manual save, Cloudflare-protected) ───────
BBALLREF_URL = "https://www.basketball-reference.com/leagues/NBA_2026_totals.html"
BBALLREF_HTML_NAME = "bballref_nba_2026_totals.html"
BBALLREF_CACHE_NAME = "bballref_positions.json"
BBALLREF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 mantle/1.0"
    ),
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
}