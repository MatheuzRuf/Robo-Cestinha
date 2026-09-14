"""Configuration for the NBA 2025-26 data ingestion pipeline.

All tunables live here so formula experimentation never touches the network
(see docs/statistics.md).
"""

from pathlib import Path

# ── Season ──────────────────────────────────────────────────────────────────
SEASON = "2025-26"          # NBA season id (forward slash form for nba_api)
SEASON_TYPE = "Regular Season"

# ── Paths ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
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
STAMINA_AGE_PENALTY = 0.05    # per season above 34
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