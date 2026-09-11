"""Stage 2 — Derive player attributes from the local raw snapshot (offline).

Reads data/raw/*.csv, computes the 12 simulator attributes per the formulas in
docs/statistics.md, and writes:
    data/processed/players.json        (the plan.md §2.1 contract)
    data/processed/teams.json
    data/processed/attributes_table.csv (raw + derived, for ML/debugging)
    data/processed/data_quality.json    (coverage + sanity report)
"""

import json

import numpy as np
import pandas as pd

from . import config
from . import bballref
from .normalize import (
    ascii_slug,
    parse_height_inches,
    safe_div,
)

FLOAT_COLS = [  # pandas should read these as floats, never strings
    "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB",
    "AST", "TOV", "STL", "BLK", "PF", "PFD", "PTS", "MIN", "GP", "AGE",
]


def _ensure(df: pd.DataFrame, col: str, default=0.0) -> pd.DataFrame:
    if col not in df.columns:
        df = df.assign(**{col: default})
    return df


def _unique_id(df: pd.DataFrame, col: str, keep: str) -> pd.DataFrame:
    """Dedupe a table on PLAYER_ID, keeping the row with highest `keep` (e.g. MIN)."""
    out = df.sort_values(keep, ascending=False).drop_duplicates("PLAYER_ID", keep="first")
    return out.reset_index(drop=True)


# ── 1. Master player table ──────────────────────────────────────────────────

def _build_master(raw: dict) -> pd.DataFrame:
    base = raw["player_stats"]["base"].copy()
    adv = raw["player_stats"]["advanced"].copy()
    all_players = raw["all_players"].copy()
    rosters = raw["rosters"].copy()

    base = _unique_id(base, "PLAYER_ID", "MIN")
    adv = _unique_id(adv, "PLAYER_ID", "MIN")
    for col in FLOAT_COLS:
        base = _ensure(base, col)
        base[col] = pd.to_numeric(base[col], errors="coerce").fillna(0.0)
    for col in FLOAT_COLS + ["USG_PCT"]:
        adv = _ensure(adv, col)
        adv[col] = pd.to_numeric(adv[col], errors="coerce").fillna(0.0)

    # Drop players with literally zero minutes (injured all season, etc.)
    played = base[base["MIN"] > 0].copy()

    # Roster-provided identity: slug/name/team come from CommonAllPlayers,
    # position from CommonTeamRoster.
    id_cols = {
        "PERSON_ID": "PLAYER_ID",
        "DISPLAY_FIRST_LAST": "NAME",
        "PLAYER_SLUG": "SLUG",
        "TEAM_ABBREVIATION": "TEAM_ID_ROSTER",
        "TEAM_NAME": "TEAM_NAME_ROSTER",
    }
    ids = all_players.rename(columns=id_cols)[list(id_cols.values())]
    ids = ids.drop_duplicates("PLAYER_ID", keep="first")

    pos = rosters.rename(columns={"PLAYER": "ROSTER_NAME", "PLAYER_SLUG": "ROSTER_SLUG"})
    pos = pos[["PLAYER_ID", "POSITION", "HEIGHT", "ROSTER_SLUG"]].drop_duplicates("PLAYER_ID", keep="first")

    merged = played.merge(ids, on="PLAYER_ID", how="left")
    merged = merged.merge(pos, on="PLAYER_ID", how="left")

    # Height -> inches (retained in the attributes table for reference).
    merged["height_in"] = merged["HEIGHT"].map(parse_height_inches)
    merged["POSITION"] = merged["POSITION"].fillna("X")

    # Classic 5-position role (PG/SG/SF/PF/C) comes exclusively from the
    # Basketball-Reference totals page, which covers every player.
    positions = raw.get("bballref_positions") or {}
    if not positions:
        raise RuntimeError(
            "Basketball-Reference position data is required (bball-ref has the "
            "classic positions for all players). Save the page once in a browser:\n"
            f"  {config.BBALLREF_URL}\n"
            f"as: {config.RAW_DIR / config.BBALLREF_HTML_NAME}\n"
            "then re-run. See docs/statistics.md §7."
        )
    lookup = {k: v["position5"] for k, v in positions.items()}
    # Manual aliases cover the few name variants that generic normalization
    # cannot resolve (nicknames / extra middle names).
    for our_norm, ref_norm in bballref.NAME_ALIASES.items():
        if ref_norm in lookup and our_norm not in lookup:
            lookup[our_norm] = lookup[ref_norm]
    nba_norm = merged["NAME"].map(lambda n: bballref.normalize_name(str(n)))
    merged["position5"] = [lookup.get(n, "X") for n in nba_norm]

    # Starter vs bench minutes (players can appear in both splits; starters are
    # whoever logged more minutes as a starter than from the bench).
    def _split_min(label: str) -> pd.Series:
        df = raw["starter_bench"][label].copy()
        df = _unique_id(df, "PLAYER_ID", "MIN")
        df = _ensure(df, "MIN")
        return df.set_index("PLAYER_ID")["MIN"]

    merged["ST_MIN"] = merged["PLAYER_ID"].map(_split_min("starters")).fillna(0.0)
    merged["BE_MIN"] = merged["PLAYER_ID"].map(_split_min("bench")).fillna(0.0)
    merged["is_starter"] = merged["ST_MIN"] >= merged["BE_MIN"]

    # Identity fallbacks for players not on a current roster (waived mid-season).
    merged["NAME"] = merged["NAME"].fillna(merged["PLAYER_NAME"])
    merged["TEAM_ID_ROSTER"] = merged["TEAM_ID_ROSTER"].fillna(merged["TEAM_ABBREVIATION"])
    merged["SLUG"] = (
        merged["SLUG"].fillna(merged["ROSTER_SLUG"]).fillna(merged["NAME"])
    )
    merged["POSITION"] = merged["POSITION"].fillna("X")

    # player_id: ascii slug, guaranteed unique.
    merged["player_id"] = merged["SLUG"].map(ascii_slug)
    used: dict[str, int] = {}
    for i, pid in enumerate(merged["player_id"]):
        n = used.get(pid, 0)
        if n:
            merged.loc[i, "player_id"] = f"{pid}_{n + 1}"
        used[pid] = n + 1

    merged["team_id"] = merged["TEAM_ID_ROSTER"].str.lower()

    # Clutch context (neutral 0.5 when nobody is in clutch situations).
    clutch = _unique_id(raw["clutch"].copy(), "PLAYER_ID", "MIN")
    for col in ["MIN", "FGM", "FGA"]:
        clutch = _ensure(clutch, col)
        clutch[col] = pd.to_numeric(clutch[col], errors="coerce").fillna(0.0)
    clutch = clutch[["PLAYER_ID", "FGM", "FGA"]].rename(
        columns={"FGM": "CL_FGM", "FGA": "CL_FGA"}
    )
    merged = merged.merge(clutch, on="PLAYER_ID", how="left")
    merged[["CL_FGM", "CL_FGA"]] = merged[["CL_FGM", "CL_FGA"]].fillna(0.0)

    # Usage rate from Advanced + league-computed advanced rates we adopt as-is.
    merged = merged.merge(
        adv[["PLAYER_ID", "USG_PCT", "PACE", "OFF_RATING", "DEF_RATING", "OREB_PCT"]],
        on="PLAYER_ID",
        how="left",
    )
    merged["USG_PCT"] = pd.to_numeric(merged["USG_PCT"], errors="coerce").fillna(0.0)
    merged["OREB_PCT"] = pd.to_numeric(merged["OREB_PCT"], errors="coerce").fillna(0.0)

    # League-computed shooting rates (FG3_PCT / FT_PCT are official columns;
    # FG_PCT is NOT used for 2pt because it already includes 3-point attempts,
    # so 2pt% is split from the constituent counts — see docs/statistics.md).
    shoot = base[["PLAYER_ID", "FG3_PCT", "FT_PCT"]].rename(
        columns={"FG3_PCT": "ENDP_FG3_PCT", "FT_PCT": "ENDP_FT_PCT"}
    )
    merged = merged.merge(shoot, on="PLAYER_ID", how="left")
    for col in ("ENDP_FG3_PCT", "ENDP_FT_PCT"):
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(0.0)

    return merged


def _team_lookup(raw: dict) -> pd.DataFrame:
    """Per-team per-game aggregates plus ratings, keyed by uppercase abbr."""
    from nba_api.stats.static.teams import get_teams

    id_to_abv = {t["id"]: t["abbreviation"] for t in get_teams()}
    tbase = raw["team_stats"]["base"].copy()
    tadv = raw["team_stats"]["advanced"].copy()
    for df in (tbase, tadv):
        for col in ["FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "TOV", "AST", "GP",
                    "MIN", "PTS", "PACE", "OFF_RATING", "DEF_RATING", "E_OFF_RATING",
                    "E_DEF_RATING"]:
            df = _ensure(df, col)
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    teams = tbase.copy()
    for col in ["PACE", "OFF_RATING", "DEF_RATING"]:
        if col in tadv.columns:
            teams[col] = tadv[col]
    teams["TEAM_ABBREVIATION"] = teams["TEAM_ID"].map(id_to_abv)
    teams = teams.rename(
        columns={"TEAM_ABBREVIATION": "team_abv", "TEAM_NAME": "team_name"}
    )
    teams["team_id"] = teams["team_abv"].str.lower()
    # FGM already includes 3-point makes (FG_PCT == FGM/FGA), so made baskets
    # per game are just FGM/GP — adding FG3M again would double-count them.
    teams["makes_pg"] = teams["FGM"] / teams["GP"]
    teams["pace"] = pd.to_numeric(teams["PACE"], errors="coerce").fillna(0.0)
    return teams


# ── 2. Attribute derivation ─────────────────────────────────────────────────

def _derive_attributes(master: pd.DataFrame, teams: pd.DataFrame, player_totals: pd.DataFrame) -> pd.DataFrame:
    m = master.copy()
    K = config.SHRINKAGE_K

    # League context
    avg2 = safe_div(float((player_totals["FGM"] - player_totals["FG3M"]).sum()),
                    float((player_totals["FGA"] - player_totals["FG3A"]).sum()))
    avg3 = safe_div(float(player_totals["FG3M"].sum()), float(player_totals["FG3A"].sum()))
    avgf = safe_div(float(player_totals["FTM"].sum()), float(player_totals["FTA"].sum()))

    t = teams.set_index("team_abv")
    m["team_abv"] = m["TEAM_ID_ROSTER"].str.upper()
    m = m.merge(
        t[["team_name", "pace", "OFF_RATING", "DEF_RATING", "makes_pg"]],
        on="team_abv", how="left",
    )
    m["team_id"] = m["team_id"].fillna(m["team_abv"].str.lower())
    # Players whose stat team isn't in team_stats (rare): use league averages.
    m["makes_pg"] = m["makes_pg"].fillna(t["makes_pg"].mean())
    m["pace"] = m["pace"].fillna(t["pace"].mean())

    m["min_pg"] = m["MIN"] / m["GP"]
    m["min_frac"] = np.clip(m["min_pg"] / 48.0, 0.0, 1.0)
    m["own_poss"] = m["FGA"] + config.FTA_POSSESSION_FACTOR * m["FTA"] + m["TOV"]

    # Shooting: raw rates read from the league's own columns where they exist
    # (FG3_PCT, FT_PCT). There is no league 2-pt-only column — FG_PCT counts
    # every thrown 3-point attempt, so 2pt% must be split from the components.
    m["_2pa"] = m["FGA"] - m["FG3A"]
    m["_2pm"] = m["FGM"] - m["FG3M"]
    m["two_pt_pct_raw"] = np.where(m["_2pa"] > 0, m["_2pm"] / m["_2pa"], 0.0)
    m["three_pt_pct_raw"] = m["ENDP_FG3_PCT"]
    m["ft_pct_raw"] = m["ENDP_FT_PCT"]
    m["two_pt_pct"] = np.where(m["_2pa"] > 0, (m["_2pm"] + K * avg2) / (m["_2pa"] + K), avg2)
    m["three_pt_pct"] = np.where(m["FG3A"] > 0, (m["FG3M"] + K * avg3) / (m["FG3A"] + K), avg3)
    m["ft_pct"] = np.where(m["FTA"] > 0, (m["FTM"] + K * avgf) / (m["FTA"] + K), avgf)

    # Possession usage
    m["turnover_rate"] = (m["TOV"] / m["own_poss"]).fillna(0.0).clip(upper=0.5)
    m["usage_rate"] = np.clip(m["USG_PCT"], 0.0, 1.0)

    # Defensive rates: fouls / steals / blocks per defended possession.
    m["def_poss_pg"] = m["pace"] * m["min_frac"]
    m["foul_rate"] = (m["PF"] / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)
    m["steal_rate"] = (m["STL"] / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)
    m["block_rate"] = (m["BLK"] / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)

    # Rebounding: the league's own offensive-rebound percentage (OREB_PCT),
    # i.e. offensive rebounds per available rebound opportunity.
    m["rebound_rate"] = m["OREB_PCT"].clip(0.0, 1.0)

    # Playmaking: assists per teammate-made basket. FGM already includes 3PM,
    # so teammate makes = team FGM/GP minus own FGM/GP (no FG3M re-add).
    own_makes_pg = m["FGM"] / m["GP"]
    teammate_makes_pg = (m["makes_pg"] - own_makes_pg).clip(lower=0.5)
    m["assist_rate"] = (m["AST"] / m["GP"] / teammate_makes_pg).fillna(0.0).clip(0.0, 1.0)

    # Stamina: minutes/game + youth → endurance capacity.
    age_penalty = config.STAMINA_AGE_PENALTY * np.clip((m["AGE"] - config.STAMINA_AGE_KNEE) / 10.0, 0, 2)
    m["stamina"] = (
        config.STAMINA_BASE
        + config.STAMINA_RANGE * np.clip(m["min_pg"] / config.STAMINA_MIN_PG, 0.0, 1.0)
        - age_penalty
    ).clip(0.0, 1.0)

    # Clutch: performance in last-5-minutes / ±5pts vs overall shooting,
    # weighted by clutch sample size so 3-attempt clutches don't swing 0<->1.
    overall_fgp = np.where(m["FGA"] > 0, m["FGM"] / m["FGA"], 0.0)
    clutch_fgp = np.where(m["CL_FGA"] > 0, m["CL_FGM"] / m["CL_FGA"], np.nan)
    clutch_delta = np.where(np.isnan(clutch_fgp), 0.0, clutch_fgp - overall_fgp)
    clutch_weight = np.clip(m["CL_FGA"] / 50.0, 0.0, 1.0)
    m["clutch_factor"] = np.clip(0.5 + config.CLUTCH_SPREAD * clutch_delta * clutch_weight, 0.0, 1.0)

    return m


# ── 3. Outputs ──────────────────────────────────────────────────────────────

ATTRS = [
    "two_pt_pct", "three_pt_pct", "ft_pct", "turnover_rate", "foul_rate",
    "rebound_rate", "assist_rate", "steal_rate", "block_rate", "stamina",
    "clutch_factor", "usage_rate",
]


def _build_players_json(m: pd.DataFrame) -> list[dict]:
    players = []
    for row in m.sort_values(["team_id", "NAME"]).itertuples(index=False):
        players.append(
            {
                "player_id": row.player_id,
                "name": str(row.NAME),
                "team_id": str(row.team_id),
                "position": str(row.POSITION),       # official NBA (G/F/C + combos)
                "position5": str(row.position5),     # classic PG/SG/SF/PF/C (bball-ref)
                "is_starter": bool(row.is_starter),  # more minutes as starter than bench
                "attributes": {
                    attr: round(float(getattr(row, attr)), 4) for attr in ATTRS
                },
            }
        )
    return players


def _build_teams_json(m: pd.DataFrame, t: pd.DataFrame, rosters: pd.DataFrame) -> list[dict]:
    id_to_slug = dict(zip(m["PLAYER_ID"], m["player_id"]))
    teams = []
    if len(rosters):
        roster_slug = {
            r["PLAYER_ID"]: r["PLAYER_SLUG"] for r in rosters.to_dict("records")
        }
    else:
        roster_slug = {}
    for _, team in t.sort_values("team_abv").iterrows():
        abv = team["team_abv"].upper()
        rosters_ids = rosters.loc[rosters["TEAM_ABBREVIATION"] == abv, "PLAYER_ID"] if len(rosters) else pd.Series(dtype="int64")
        player_ids = [
            id_to_slug.get(pid, ascii_slug(roster_slug.get(pid, str(pid))))
            for pid in rosters_ids
        ]
        teams.append(
            {
                "team_id": str(team["team_id"]),
                "name": str(team["team_name"]),
                "abbreviation": abv,
                "roster": sorted(player_ids) if player_ids else sorted(
                    m.loc[m["TEAM_ID_ROSTER"].str.upper() == abv, "player_id"].tolist()
                ),
                "team_stats": {
                    "pace": round(float(team.get("pace", 0.0)), 2),
                    "off_rtg": round(float(team.get("OFF_RATING", 0.0)), 1),
                    "def_rtg": round(float(team.get("DEF_RATING", 0.0)), 1),
                },
                "season": config.SEASON,
            }
        )
    return teams


def _quality_report(m: pd.DataFrame, raw: dict) -> dict:
    report = {
        "season": config.SEASON,
        "players_with_stats": int(len(m)),
        "teams": int(m["team_id"].nunique()),
        "position_distribution": {k: int(v) for k, v in m["POSITION"].value_counts().items()},
        "position5_distribution": {k: int(v) for k, v in m["position5"].value_counts().items()},
        "position5_missing": int((m["position5"] == "X").sum()),
        "starters": int(m["is_starter"].sum()),
        "bench_players": int((~m["is_starter"]).sum()),
        "small_sample_lt10gp": int((m["GP"] < config.MIN_GP_FOR_SAMPLE_FLAG).sum()),
        "players_with_clutch_minutes": int((m["CL_FGA"] > 0).sum()),
        "usage_missing_defaulted": int((m["USG_PCT"] == 0).sum()),
        "attribute_stats": {
            attr: {
                "min": round(float(m[attr].min()), 4),
                "mean": round(float(m[attr].mean()), 4),
                "max": round(float(m[attr].max()), 4),
            }
            for attr in ATTRS
        },
    }
    played_ids = set(m["PLAYER_ID"])
    roster_ids = set(raw["all_players"]["PERSON_ID"])
    report["rostered_but_zero_minutes_excluded"] = int(len(roster_ids - played_ids))
    return report


def derive(raw: dict) -> None:
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    player_totals = raw["player_stats"]["base"].copy()
    player_totals = player_totals[
        (player_totals["MIN"] > 0)
    ].copy().reset_index(drop=True)

    master = _build_master(raw)
    teams = _team_lookup(raw)
    master = _derive_attributes(master, teams, player_totals)

    players_json = _build_players_json(master)
    teams_json = _build_teams_json(master, teams, raw["rosters"])
    report = _quality_report(master, raw)

    with open(config.PROCESSED_DIR / "players.json", "w") as fh:
        json.dump(players_json, fh, indent=2, ensure_ascii=False)
    with open(config.PROCESSED_DIR / "teams.json", "w") as fh:
        json.dump(teams_json, fh, indent=2, ensure_ascii=False)
    with open(config.PROCESSED_DIR / "data_quality.json", "w") as fh:
        json.dump(report, fh, indent=2)

    table_cols = [
        "PLAYER_ID", "player_id", "NAME", "team_id", "POSITION", "position5",
        "height_in", "is_starter", "ST_MIN", "BE_MIN", "AGE",
        "GP", "MIN", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA",
        "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK", "PF", "PTS",
        "USG_PCT", "OREB_PCT", "ENDP_FG3_PCT", "ENDP_FT_PCT",
        "own_poss", "min_pg", "def_poss_pg",
        "two_pt_pct_raw", "three_pt_pct_raw", "ft_pct_raw", *ATTRS,
    ]
    master[table_cols].to_csv(config.PROCESSED_DIR / "attributes_table.csv", index=False)

    print("[derive] wrote:")
    for name in ("players.json", "teams.json", "data_quality.json", "attributes_table.csv"):
        print(f"  {config.PROCESSED_DIR / name}")
    print(f"[derive] players = {len(players_json)}, teams = {len(teams_json)}")
    return players_json, teams_json, report