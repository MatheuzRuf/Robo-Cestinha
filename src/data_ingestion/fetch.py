"""Stage 1 — Fetch raw NBA 2025-26 data to disk (data/raw).

~38 throttled calls to stats.nba.com, each response saved verbatim as CSV
so re-runs never touch the network (unless --refresh). Plus an optional
Basketball-Reference page (classic positions) that must be saved manually.

Call plan (see docs/statistics.md):
  1 × CommonAllPlayers          -> all_players.csv
 30 × CommonTeamRoster          -> rosters/{ABV}.csv   (position per player)
  1 × LeagueDashPlayerStats B   -> player_stats_base_totals.csv
  1 × LeagueDashPlayerStats A   -> player_stats_advanced_totals.csv
  1 × LeagueDashPlayerClutch    -> player_clutch_totals.csv
  2 × LeagueDashPlayerStats SB  -> player_stats_{starters,bench}_totals.csv
  2 × LeagueDashTeamStats B+A   -> team_stats_*_totals.csv
  1 × Basketball-Reference (optional, manual save) -> bballref_*.html
"""

import time

import pandas as pd

from nba_api.stats.endpoints.commonallplayers import CommonAllPlayers
from nba_api.stats.endpoints.commonteamroster import CommonTeamRoster
from nba_api.stats.endpoints.leaguedashplayerclutch import LeagueDashPlayerClutch
from nba_api.stats.endpoints.leaguedashplayerstats import LeagueDashPlayerStats
from nba_api.stats.endpoints.leaguedashteamstats import LeagueDashTeamStats
from nba_api.stats.static.teams import get_teams

from . import config
from . import bballref


class FetchError(RuntimeError):
    pass


def _call(factory, **kwargs) -> pd.DataFrame:
    """Throttled + retried endpoint call returning its first data frame."""
    last_err = None
    for attempt in range(config.RETRIES):
        try:
            time.sleep(config.SECONDS_BETWEEN_CALLS)
            res = factory(season=config.SEASON, timeout=config.TIMEOUT_S, **kwargs)
            frames = res.get_data_frames()
            if not frames:
                raise FetchError("endpoint returned no data frames")
            return frames[0]
        except Exception as err:  # noqa: BLE001 - retry every failure class
            last_err = err
            wait = config.BACKOFF_BASE_S * (2**attempt)
            print(f"  ! attempt {attempt + 1} failed ({err}); retrying in {wait}s")
            time.sleep(wait)
    raise FetchError(f"gave up after {config.RETRIES} attempts: {last_err}")


def _save(df: pd.DataFrame, path) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"  saved {len(df):>5} rows -> {path.relative_to(config.ROOT)}")
    return True


# ── Endpoint fetchers (each cached as a file) ───────────────────────────────

def fetch_all_players(refresh: bool) -> pd.DataFrame:
    path = config.RAW_DIR / "all_players.csv"
    if path.exists() and not refresh:
        print(f"  cached          -> {path.relative_to(config.ROOT)}")
        return pd.read_csv(path)
    df = _call(CommonAllPlayers, is_only_current_season=1)
    _save(df, path)
    return df


def fetch_team_rosters(refresh: bool) -> pd.DataFrame:
    frames, missing = [], []
    for team in get_teams():
        abv = team["abbreviation"]
        path = config.ROSTER_DIR / f"{abv}.csv"
        if path.exists() and not refresh:
            print(f"  cached          -> {path.relative_to(config.ROOT)}")
            df = pd.read_csv(path)
        else:
            try:
                df = _call(CommonTeamRoster, team_id=team["id"])
                _save(df, path)
            except FetchError as err:
                missing.append((abv, str(err)))
                continue
        df["TEAM_ABBREVIATION"] = abv
        frames.append(df)
    if missing:
        print(f"  ! roster fetch failures: {missing}")
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def fetch_player_stats(refresh: bool) -> dict[str, pd.DataFrame]:
    out = {}
    for label, measure in (("base", "Base"), ("advanced", "Advanced")):
        path = config.RAW_DIR / f"player_stats_{label}_totals.csv"
        if path.exists() and not refresh:
            print(f"  cached          -> {path.relative_to(config.ROOT)}")
        else:
            df = _call(
                LeagueDashPlayerStats,
                measure_type_detailed_defense=measure,
                per_mode_detailed="Totals",
            )
            _save(df, path)
        out[label] = pd.read_csv(path)
    return out


def fetch_clutch(refresh: bool) -> pd.DataFrame:
    path = config.RAW_DIR / "player_clutch_totals.csv"
    if path.exists() and not refresh:
        print(f"  cached          -> {path.relative_to(config.ROOT)}")
    else:
        df = _call(LeagueDashPlayerClutch, per_mode_detailed="Totals")
        _save(df, path)
    return pd.read_csv(path)


def fetch_starter_bench(refresh: bool) -> dict[str, pd.DataFrame]:
    """Per-player split into starter vs bench minutes (same players can be both)."""
    out = {}
    for label, value in (("starters", "Starters"), ("bench", "Bench")):
        path = config.RAW_DIR / f"player_stats_{label}_totals.csv"
        if path.exists() and not refresh:
            print(f"  cached          -> {path.relative_to(config.ROOT)}")
        else:
            df = _call(
                LeagueDashPlayerStats,
                measure_type_detailed_defense="Base",
                per_mode_detailed="Totals",
                starter_bench_nullable=value,
            )
            _save(df, path)
        out[label] = pd.read_csv(path)
    return out


def fetch_team_stats(refresh: bool) -> dict[str, pd.DataFrame]:
    out = {}
    for label, measure in (("base", "Base"), ("advanced", "Advanced")):
        path = config.RAW_DIR / f"team_stats_{label}_totals.csv"
        if path.exists() and not refresh:
            print(f"  cached          -> {path.relative_to(config.ROOT)}")
        else:
            df = _call(
                LeagueDashTeamStats,
                measure_type_detailed_defense=measure,
                per_mode_detailed="Totals",
            )
            _save(df, path)
        out[label] = pd.read_csv(path)
    return out


def load_raw_from_disk() -> dict:
    """Read-only loader: requires every raw file to already exist locally."""
    needed = {
        "all_players": config.RAW_DIR / "all_players.csv",
        "rosters_dir": config.ROSTER_DIR,
        "player_base": config.RAW_DIR / "player_stats_base_totals.csv",
        "player_advanced": config.RAW_DIR / "player_stats_advanced_totals.csv",
        "clutch": config.RAW_DIR / "player_clutch_totals.csv",
        "team_base": config.RAW_DIR / "team_stats_base_totals.csv",
        "team_advanced": config.RAW_DIR / "team_stats_advanced_totals.csv",
    }
    missing = [str(p) for p in needed.values() if p.exists() is False]
    if missing:
        raise FileNotFoundError(
            "raw cache incomplete, run without --no-fetch first: " + ", ".join(missing)
        )
    roster_files = sorted(config.ROSTER_DIR.glob("*.csv"))
    rosters = pd.concat(
        [pd.read_csv(p).assign(TEAM_ABBREVIATION=p.stem) for p in roster_files],
        ignore_index=True,
    )
    print(f"[fetch] loaded {len(rosters)} roster rows from local cache")
    return {
        "all_players": pd.read_csv(config.RAW_DIR / "all_players.csv"),
        "rosters": rosters,
        "player_stats": {
            "base": pd.read_csv(config.RAW_DIR / "player_stats_base_totals.csv"),
            "advanced": pd.read_csv(config.RAW_DIR / "player_stats_advanced_totals.csv"),
        },
        "clutch": pd.read_csv(config.RAW_DIR / "player_clutch_totals.csv"),
        "starter_bench": {
            "starters": pd.read_csv(config.RAW_DIR / "player_stats_starters_totals.csv"),
            "bench": pd.read_csv(config.RAW_DIR / "player_stats_bench_totals.csv"),
        },
        "bballref_positions": bballref.load(refresh=False),
        "team_stats": {
            "base": pd.read_csv(config.RAW_DIR / "team_stats_base_totals.csv"),
            "advanced": pd.read_csv(config.RAW_DIR / "team_stats_advanced_totals.csv"),
        },
    }


# ── Orchestrator ────────────────────────────────────────────────────────────

def fetch_all(refresh: bool = False) -> dict:
    """Pull every raw dataset (or read the local cache). Returns raw frames."""
    print(f"[fetch] season={config.SEASON} refresh={refresh} cache={config.RAW_DIR}")
    all_players = fetch_all_players(refresh)
    rosters = fetch_team_rosters(refresh)
    player_stats = fetch_player_stats(refresh)
    clutch = fetch_clutch(refresh)
    starter_bench = fetch_starter_bench(refresh)
    team_stats = fetch_team_stats(refresh)
    print("[fetch] done.")
    return {
        "all_players": all_players,
        "rosters": rosters,
        "player_stats": player_stats,
        "clutch": clutch,
        "starter_bench": starter_bench,
        "team_stats": team_stats,
        "bballref_positions": bballref.load(refresh),
    }