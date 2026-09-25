# Data Ingestion — Architecture & Inner Workings

**Module:** `backend/src/app/data_ingestion/`
**Runs as:** `python -m app.data_ingestion` (installed package `app` → this module)
**Input:** raw NBA 2025-26 data in `data/raw/2025_26/` (fetched from stats.nba.com, saved verbatim)
**Output:** `data/processed/` — `players.json`, `teams.json`, `attributes_table.csv`, `data_quality.json`
**Formulas:** see [`docs/statistics.md`](statistics.md) — this document covers *machinery*; that one covers *math*.

---

## 1. What the pipeline does

It turns three kinds of raw season data (player totals, team totals, rosters,
clutch splits) into the two files every downstream component consumes:

| Output | Contents |
|---|---|
| `players.json` | 582 players with ≥1 minute played, each with identity (slug, name, team, positions) + the **12 simulator attributes** (all 0–1) + `is_starter` |
| `teams.json` | 30 teams with name, abbreviation, season, `team_stats` (pace, off/def rating) and a `roster` of player ids |
| `attributes_table.csv` | flat table: every raw endpoint column + every derived attribute (for ML / debugging) |
| `data_quality.json` | coverage & sanity report (see §8) |

Everything runs **offline** on the raw cache — the network is hit only by the
fetch stage, and only when a file is missing or `--refresh` is passed.

## 2. Stage diagram

```
┌──────────────────────────  Stage 1: fetch.py  ──────────────────────────┐
│ stats.nba.com (nba-api) ──throttled, retried──► data/raw/2025_26/*.csv  │
│ Basketball-Reference    ──manually saved html─► data/raw/2025_26/       │
│                          bballref_nba_2026_totals.html (Cloudflare)     │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌──────────────────────────  Stage 2: derive.py  ─────────────────────────┐
│ _build_master      : one row per player (identity + raw totals)         │
│ _team_lookup       : per-team aggregates + pace/ratings                 │
│ _derive_attributes : the 12 attributes (see statistics.md)              │
│ _build_players_json / _build_teams_json                                 │
│ schemas.validate_processed_output()   ◄── CONTRACT GATE, before writes  │
│ _quality_report    : data_quality.json                                  │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
               data/processed/  (players.json, teams.json, …)
```

## 3. Directory layout & path resolution

```
repo root/
├── pyproject.toml            wheel builds packages = ["backend/src/app"]
├── data/
│   ├── raw/2025_26/          fetched CSV cache + bball-ref html/json (gitignored)
│   └── processed/            derived outputs (tracked in git)
└── backend/src/app/data_ingestion/
    ├── config.py             every path + tunable lives here
    ├── fetch.py              stage 1: network ⇄ raw cache ⇄ raw dict
    ├── bballref.py           parse Basketball-Reference positions page
    ├── normalize.py          slug / height / safe-div / league possessions helpers
    ├── derive.py             stage 2: raw dict → players.json/teams.json
    ├── schemas.py            output contract (Pydantic validators + integrity)
    ├── __main__.py           CLI entry (`python -m app.data_ingestion`)
    └── ingest_data.py        legacy alias for `python -m app.data_ingestion.ingest_data`
```

**Path resolution (`config.py`).** The module sits three levels under
`backend/src/…` while `data/` lives at the repo root, so `ROOT` is *discovered*
rather than hard-coded: walk up from the module until an ancestor contains both
`pyproject.toml` and a `data/` directory. Requiring **both** markers keeps the
search stable even if a nested `backend/pyproject.toml` ever reappears.

- `RAW_DIR = ROOT/data/raw/2025_26` (season id with `-` → `_`)
- `ROSTER_DIR = RAW_DIR/rosters` (one `{ABV}.csv` per team)
- `PROCESSED_DIR = ROOT/data/processed`

## 4. Stage 1 — `fetch.py`: do not run from memory

Every endpoint response is saved **verbatim as CSV**; downstream stages and
re-runs read the files, never the network. The orchestrator (`fetch_all`)
returns a plain dict of `DataFrame`s:

```python
raw = {
  "all_players":      CommonAllPlayers (id, name, slug, team),
  "rosters":          concat of rosters/{ABV}.csv, tagged with TEAM_ABBREVIATION,
  "player_stats":     {"base", "advanced"} LeagueDashPlayerStats Totals,
  "clutch":           LeagueDashPlayerClutch Totals,
  "starter_bench":    {"starters", "bench"} per-player minute splits,
  "team_stats":       {"base", "advanced"} LeagueDashTeamStats Totals,
  "bballref_positions": {normalized_name: {position5, …}} from bballref.load(),
}
```

**Network discipline.** `_call()` sleeps `SECONDS_BETWEEN_CALLS` (0.7 s) before
every request, retries up to `RETRIES` (4) times on any exception with
exponential backoff starting at `BACKOFF_BASE_S` (2 s), and times out at
`TIMEOUT_S` (30 s). 39 requests total: 1 × CommonAllPlayers + 30 ×
CommonTeamRoster + 1 + 1 + 1 player stat/clutch + 2 starter/bench + 2 team
stat, plus the bball-ref best-effort.

**Cache logic.** `fetch_*` helpers check the target file first and only call
the endpoint when missing (`refresh=False`) or always when `refresh=True`.
`fetch_team_rosters` degrades gracefully: a failing team's roster is skipped
and reported, the rest still load.

**`load_raw_from_disk()`** is the read-only twin of `fetch_all()` for
`--no-fetch`: it verifies *every* required file exists (including the
starter/bench CSVs and the roster directory) and raises a `FileNotFoundError`
naming exactly what's missing before any derive work starts. Basketball-Reference
positions come from the cached `bballref_positions.json` (or fresh parse of the
saved HTML — see §5).

## 5. Basketball-Reference positions (`bballref.py`)

stats.nba.com only publishes **G / F / C** (and combos). The classic
PG/SG/SF/PF/C taxonomy (`position5`) comes from Basketball-Reference's league
totals page, which sits behind a Cloudflare challenge and **cannot be fetched
by scripts**. Workflow:

1. Save the page once in a browser (`Ctrl+S`, HTML only) to
   `data/raw/2025_26/bballref_nba_2026_totals.html`.
2. `bballref.load()` scans the first `<table>` with a stdlib `HTMLParser`
   (`_TableScanner`, no lxml/bs4 dependency), finds the header row containing
   `Player` + `Pos` columns, and maps every row to `{normalized_name: entry}`.
   The primary of `SF-PF`-style cells becomes `position5`.
3. The result is cached to `bballref_positions.json` so offline re-derives
   never need the HTML again.
4. Name joining: `normalize_name()` strips `(TW)`-style parenthetical suffixes,
   drops generational suffixes (`Jr`, `Sr`, `II`–`IV`), collapses initial
   periods (`A.J.` → `aj`), and ascii-slugs diacritics (`porziņģis` →
   `porzingis`). A tiny explicit alias map covers the few remaining
   nickname/extras variants (Tre Scott, Ron Holland, Adama Alpha Bal).

**Refresh semantics.** The HTML is a manually-saved artifact that scripts
cannot re-fetch (Cloudflare), so `--refresh` **re-parses the local page and
rebuilds the JSON cache** — it never attempts a re-download. The network
fallback (a best-effort GET, usually HTTP 403) is only tried when *no* local
copy exists at all. `load(refresh=False)` also serves the cache alone, which
is why `--no-fetch` works fully offline.

If neither the cache nor the HTML exists, `derive` refuses to run with
instructions (positions are a required input, not optional).

## 6. Stage 2 — `derive.py`: master table → attributes → contract

### 6.1 `_build_master(raw)` — one row per player

Joins, in order:

1. **`player_stats.base`** — deduped by `PLAYER_ID` (keep max `MIN`), numeric
   coercion of every stat column with `FLOAT_COLS`, rows with `MIN == 0`
   dropped (injured/two-way players never enter the pipeline).
2. **Identity** from `CommonAllPlayers` (`PERSON_ID`, `DISPLAY_FIRST_LAST`,
   `PLAYER_SLUG`) and **`POSITION`/`HEIGHT`** from the roster files
   (`CommonTeamRoster`), joined on `PLAYER_ID`. Players without a roster row
   get `POSITION = "X"`.
3. **`position5`** from the bball-ref mapping by normalized name (fallback `"X"`).
4. **Starter/bench minutes** from `player_stats_{starters,bench}` — a player
   counts as starter if `ST_MIN >= BE_MIN`.
5. **Clutch context** (`CL_FGM`/`CL_FGA`) from `LeagueDashPlayerClutch`,
   defaulting to 0 (no clutch minutes ⇒ neutral `clutch_factor = 0.5`).
6. **Advanced columns** `USG_PCT`, `OREB_PCT` and league shooting columns
   `FG3_PCT`/`FT_PCT` (prefixed `ENDP_*` so they are not confused with derived
   columns).

**Canonical team.** `TEAM_ID_ROSTER` is taken from the *stats* table's
`TEAM_ABBREVIATION` — the club the player logged his minutes for. See §7 for
why this matters.

**Unique ids.** `player_id` is the ascii slug of the name, with numeric
suffixes (`_2`, `_3`, …) appended on collision, so ids are guaranteed unique
even for identically-named players. `team_id` is the lowercase abbreviation;
`team_abv` stays uppercase for joins.

### 6.2 `_team_lookup(raw)` — per-team context

Per-team totals (with `GP` for denominators), plus `PACE`, `OFF_RATING`,
`DEF_RATING` copied from the *advanced* endpoint when present
(`E_OFF_RATING`/`E_DEF_RATING` in base are not used for the JSON).
`makes_pg = FGM / GP` — team made-baskets per game (FGM already includes
three-pointers; never re-add `FG3M`).

### 6.3 `_derive_attributes(master, teams, player_totals)` — the formulas

League context (computed once from the full player-totals table):

- `avg2` / `avg3` / `avgf` — league 2pt/3pt/FT make rates (shrinkage anchors);
- `team_poss_pg = Σ(FGA + 0.44·FTA + TOV) ÷ team_games` — the uniform defensive
  possession denominator. `GP` sums over 30 teams (2460 team-games), exactly
  the "113.2" referenced in statistics.md.

The 12 attributes derive per player — every formula and its worked example is
in statistics.md §2–§6. The only machine-level details worth restating:

- Shooting rates are **shrunk** toward the league mean with `SHRINKAGE_K`
  (10) pseudo-attempts.
- Defensive rates use `def_poss_pg = team_poss_pg × min_frac` where
  `min_frac = min(min_pg / 48, 1)`.
- `usage_rate` and `rebound_rate` are the league's own `USG_PCT` / `OREB_PCT`
  columns, clipped to [0, 1].
- Stamina and clutch are the age/minutes model and clutch-fg-delta model from
  statistics.md §6; every attribute is finally clipped to [0, 1] and rounded
  to 4 decimals in `_build_players_json`.

### 6.4 `_build_players_json` / `_build_teams_json` — the output files

- `players.json`: one object per master row, sorted by `team_id` then name.
- `teams.json`: one object per team (sorted by `team_abv`), roster built from
  the *players* table (`m`), see §7.

### 6.5 The contract gate (`schemas.py`) — before any write

`derive()` calls `schemas.validate_processed_output(players_json, teams_json)`
**before opening any output file**. On failure it raises `SchemaValidationError`
with *every* problem listed at once; the CLI catches it and prints
`[error] derive output failed schema validation, nothing was written`
(exit code 1). This is the enforcement point plan.md §2.1 / Phase A requires —
it converts the schema docstring into an executable single source of truth and
protects last known-good output from partial overwrites.

## 7. Two policy decisions that keep the files consistent

1. **Zero-minute players are excluded.** `players.json` is scoped to "≥1
   minute played" (582 players). Team rosters therefore also exclude the ~5
   current-roster players with zero minutes — they have no attributes and
   never play.
2. **A player's team is his *season* team.** ~57 players were waived
   mid-season and have a stats row but no current-roster row. Giving them the
   club they played for (stats `TEAM_ABBREVIATION`) means:

   - every player has exactly one `team_id` that exists in `teams.json`;
   - every `team.roster` entry is a real player in `players.json`;
   - membership agrees both ways — all three referential-integrity checks pass
     **by construction** (582 roster entries, 30 teams).

   CommonTeamRoster files are still used — for `POSITION`, `HEIGHT` and name
   slugs — just not for membership. Team size varies 16–25 depending on how
   many players each franchise cycled through the season (MEM 25, HOU 16).

The previous implementation sourced rosters from the roster files, which made
`teams.json` violate the contract in *both* directions (5 roster entries
without players, 57 players without roster entries) — it was only invisible
because validation was never wired in.

## 8. `data_quality.json` — the sanity report

Besides season, counts and position distributions, key fields:

| Field | Meaning |
|---|---|
| `players_with_stats` / `teams` | 582 / 30 |
| `starters` / `bench_players` | 216 / 366 |
| `small_sample_lt10gp` | players under `MIN_GP_FOR_SAMPLE_FLAG` (10) GP — their rates are shrinkage-heavy |
| `players_with_clutch_minutes` | nonzero clutch FGA (413) |
| `usage_missing_defaulted` | players whose `USG_PCT` was missing and defaulted to 0 (should be 0) |
| `attribute_stats` | min/mean/max per attribute — a quick sanity sweep of ranges |
| `position5_missing` | players without a bball-ref match (0; all 582 matched) |
| `rostered_but_zero_minutes_excluded` | CommonAllPlayers players with 0 minutes (not in players.json) |
| `zero_minute_roster_players_excluded` | roster-file players with 0 minutes (not in rosters) — 5 |
| `stats_players_not_on_active_roster` | players with stats but no current-roster row — 57 (kept with their season team) |
| `roster_entries` | sum of `teams.json` rosters — 582 (== players_with_stats) |

## 9. Running the pipeline

From the repo root (after `uv sync`, which installs the `app` package):

```bash
# fetch everything (network; ~39 throttled calls) then derive
.venv/bin/python -m app.data_ingestion

# derive only, from the local raw cache — fails fast if a cached file is missing
.venv/bin/python -m app.data_ingestion --no-fetch

# force re-download of every raw dataset (the Basketball-Reference page is
# Cloudflare-protected and never re-downloaded; --refresh re-parses the
# saved page and rebuilds its cache — see §5)
.venv/bin/python -m app.data_ingestion --refresh
```

`--refresh` and `--no-fetch` are mutually exclusive (parser error). The legacy
`python -m app.data_ingestion.ingest_data` entry point behaves identically.
Without a synced venv, `PYTHONPATH=backend/src` before the command achieves the
same imports.

**Typical happy path for a brand-new season:** save the bball-ref HTML once in
a browser (see §5 and statistics.md §7), then run without flags; the fetch
stage fills `data/raw/`, the derive stage validates and writes
`data/processed/`.

## 10. Failure modes

| Symptom | Cause | Message / fix |
|---|---|---|
| `raw cache incomplete … run without --no-fetch first: <paths>` | `--no-fetch` but a required CSV missing | rerun without `--no-fetch`, or restore the missing files |
| `Basketball-Reference position data is required …` | no `bballref_positions.json` and no saved HTML | save the page once in a browser (statistics.md §7.1). `--refresh` does **not** re-download the page; it re-parses the local copy — if you saw a 403 during a `--refresh` run, your saved HTML is still used |
| `derive output failed schema validation, nothing was written` (exit 1) | a row violates the contract (out-of-range attribute, dup id, broken roster link) | the error lists every failing record; fix upstream data or formula, then rerun |
| `gave up after 4 attempts: …` | endpoint throttled/unreachable after retries | wait, rerun — cache files already saved are reused |
| `! roster fetch failures: [(abv, err)]` | one team's roster call failed | other 29 load; rerun later to fill the gap |
| `! bball-ref returned HTTP 403 …` | Cloudflare block on a scripted GET (only attempted when no local page exists) | save the page manually once; the pipeline then never needs the network for it |

## 11. Tunables (`config.py`)

All formula knobs live in `config.py` so experimentation never touches the
network: `SHRINKAGE_K`, `CLUTCH_SPREAD`, `STAMINA_*`, `MIN_GP_FOR_SAMPLE_FLAG`,
`FTA_POSSESSION_FACTOR`, throttle/retry/timeout constants, and the
season/paths/URLs block. Change a knob, rerun `--no-fetch`, and compare
`players.json` or `data_quality.json` diffs.