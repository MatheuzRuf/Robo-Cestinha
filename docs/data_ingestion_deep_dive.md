# Data Ingestion — Complete Deep Dive

**Module:** `backend/src/app/data_ingestion/`
**Docs companions:** [`data_ingestion.md`](data_ingestion.md) (architecture & machinery), [`statistics.md`](statistics.md) (every formula + worked examples), [`ARCHITECTURE.md`](ARCHITECTURE.md) (system view), [`presentation_data_ingestion.md`](presentation_data_ingestion.md) (talk script)
**This document:** a code-level, end-to-end study guide of the ingestion module *and* every piece of the project that interacts with it — written to be presented as if you built it yourself.

---

## 0. TL;DR — what this module does

"Robô Cestinha" is a basketball simulator. The simulation engine is *purely probabilistic*: every shot, pass, turnover, foul, rebound and clutch moment is decided by rolling a random number against a player's attributes. Those attributes have to come from somewhere real — that's what this module is for.

The module turns raw NBA season data into **two JSON files that are the contract for the whole backend**:

- `data/processed/players.json` — **582 players**, each with identity + **12 attributes**, all scaled **0–1** (so they map 1:1 onto engine probabilities).
- `data/processed/teams.json` — **30 teams**, each with a `roster` of player ids, pace, and offensive/defensive ratings.

It is built as a **two-stage, offline-first pipeline**:

```
Stage 1  fetch.py    stats.nba.com ── throttled, retried ──► data/raw/2025_26/*.csv   (verbatim cache)
                    Basketball-Reference (Cloudflare) ──manual browser save──► .html ──parsed──► .json
                                                                                                │
Stage 2  derive.py   raw CSVs ──pandas joins & formulas──► mater tables ──► 12 attributes        │
                    ──schemas.py validation GATE (before any write)──► players.json · teams.json │
                                                                              │                    │
Consumers          engine (entities/heuristics)  ·  db/seed.py ─► PostgreSQL  ·  demo scripts     │
                    ────────────────────────────── all import / validate against schemas.py ◄────┘
```

The whole thing runs with: `python -m app.data_ingestion` (`--no-fetch` to derive offline only, `--refresh` to force a raw re-download).

---

## 1. Why the design is the way it is (the 3 big ideas)

Before the code, the three decisions that explain ~80% of everything you see in the module:

### 1.1 The contract-first philosophy (plan.md §2.1)

The project plan (`plan.md`, §2.1, "Shared Data Schemas (Defined First — Blocking for All Modules)") designates `players.json` / `teams.json` as **the contract between components**. Nothing downstream may invent its own reading of the catalog: the engine builds live teams from these files, the database seed loads them into PostgreSQL, demos load them directly.

This module is the **owner** of that contract. It produces the files *and* it ships the enforcement (`schemas.py`) that every consumer also uses. That is why you will see the same Pydantic classes imported in `app/engine/entities.py` — the engine literally shares the schema classes with the ingestion pipeline.

### 1.2 Network and derivation are separated (Stage 1 / Stage 2)

- **Stage 1** is the only place that touches the network. Every response is saved *verbatim* as CSV before any processing. Never trust a remote API you have to re-ask twice: after the first run, everything downstream reads files.
- **Stage 2** is pure offline pandas. Re-running it is free, reproducible, and fast — this makes formula experimentation (tuning `config.py` constants) a 5-second cycle instead of a network cycle.

### 1.3 "Fail loudly before you overwrite good data"

The derived output is validated against the schema **in memory, before any file is written**. A malformed run does not silently destroy the last known-good `players.json`; it prints *every* problem at once and exits 1. The same validator is reused at consumption time (demos re-validate the files they load), so a bad catalog can't sneak past the pipeline and break the engine later.

---

## 2. Module map

```
backend/src/app/data_ingestion/
├── __init__.py      package doc + __version__ = "0.3.0"
├── config.py        single source of truth: season, paths, network knobs, formula knobs
├── fetch.py         Stage 1 — throttled/retried endpoint calls, verbatim CSV cache, raw-dict builder
├── bballref.py      Basketball-Reference positions: manual-save workflow, stdlib HTML parser, cache
├── normalize.py     shared micro-helpers: ascii_slug, parse_height_inches, safe_div, league possessions
├── derive.py        Stage 2 — raw dict → master table → 12 attributes → players/teams JSON (+ gate)
├── schemas.py       the executable output contract: Pydantic models + referential-integrity checks
├── __main__.py      CLI entry: `python -m app.data_ingestion [--refresh] [--no-fetch]`
└── ingest_data.py   legacy alias module → re-exports __main__.main
```

Data directories (at the **repo root**, not inside `backend/`):

```
data/
├── raw/
│   └── 2025_26/            ← RAW_DIR (season id "2025-26" → dir name "2025_26")
│       ├── all_players.csv
│       ├── rosters/{ABV}.csv          (30 files)
│       ├── player_stats_base_totals.csv / player_stats_advanced_totals.csv
│       ├── player_clutch_totals.csv
│       ├── player_stats_starters_totals.csv / player_stats_bench_totals.csv
│       ├── team_stats_base_totals.csv / team_stats_advanced_totals.csv
│       ├── bballref_nba_2026_totals.html      (manual browser save, Cloudflare-protected)
│       └── bballref_positions.json            (parsed cache of the HTML)
└── processed/            ← PROCESSED_DIR
    ├── players.json      (582 players · the contract)
    ├── teams.json        (30 teams · the contract)
    ├── attributes_table.csv  (every raw + derived column, one row per player — ML/debugging)
    └── data_quality.json     (coverage & sanity report)
```

The package is installed as part of the `app` package (`pyproject.toml` builds a wheel with `packages = ["backend/src/app"]`), so after `uv sync` everything is importable as `app.data_ingestion.*` and `python -m app.data_ingestion` works from the repo root.

---

## 3. `config.py` — every constant, explained

The design rule is: **all tunables live here so formula experimentation never touches the network**.

### 3.1 Season

```python
SEASON = "2025-26"          # forward-slash form, the format nba_api expects
SEASON_TYPE = "Regular Season"
```

Note the two spellings: `nba_api` wants `"2025-26"`, but a directory name can't contain `/`, so the raw dir uses `SEASON.replace("-", "_")` → `data/raw/2025_26`. Also note this is the **regular season only** — no playoffs. The rationale (documented in `statistics.md`) is that 60–82 games give the most stable per-player rates.

### 3.2 Path resolution — why there's a search loop, not a hardcoded path

```python
def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").is_file() and (parent / "data").is_dir():
            return parent
    raise RuntimeError(...)
```

The module lives at `backend/src/app/data_ingestion/` but `data/` is at the repo root. Both markers (`pyproject.toml` **and** `data/`) must be present to call a directory the repo root. Why two markers instead of a fixed `parents[n]` offset? Because offsets are brittle: if someone later adds a nested `backend/pyproject.toml` the relative depth changes, and a naive search that matched only `pyproject.toml` would pick the wrong ancestor. Requiring both keeps the search unambiguous in either case.

Derived paths:
- `RAW_DIR = ROOT/data/raw/2025_26`
- `ROSTER_DIR = RAW_DIR/rosters`
- `PROCESSED_DIR = ROOT/data/processed`

### 3.3 Network / throttling

```python
SECONDS_BETWEEN_CALLS = 0.7   # polite delay before every request
RETRIES = 4                   # attempts per call
BACKOFF_BASE_S = 2.0          # exponential backoff 2^attempt
TIMEOUT_S = 30
```

These are the "be a polite guest" constants: never hammer stats.nba.com. (Real values: an NBA season ≈ 38 endpoint requests — trivially easy to throttle.)

### 3.4 Derivation tunables (the "experiment knobs")

| Constant | Value | What it tunes |
|---|---|---|
| `SHRINKAGE_K` | 10.0 | pseudo-attempts pulled toward league mean for shooting stats |
| `CLUTCH_SPREAD` | 2.0 | sensitivity of `clutch_factor` to clutch FG% delta |
| `STAMINA_BASE` | 0.55 | stamina floor for a zero-minute player |
| `STAMINA_RANGE` | 0.45 | additional stamina up to a minutes cap |
| `STAMINA_MIN_PG` | 38.0 | minutes/game that saturates the stamina bonus |
| `STAMINA_AGE_PENALTY` | 0.05 | × ((age − 34) / 10) — 0.005 per year above 34 |
| `STAMINA_AGE_KNEE` | 34.0 | age at which the penalty starts |
| `MIN_GP_FOR_SAMPLE_FLAG` | 10 | below this GP a player is flagged "small sample" in the quality report |
| `FTA_POSSESSION_FACTOR` | 0.44 | standard NBA possession constant (not every FT starts a new possession) |

### 3.5 Basketball-Reference artifact

```python
BBALLREF_URL = "https://www.basketball-reference.com/leagues/NBA_2026_totals.html"
BBALLREF_HTML_NAME = "bballref_nba_2026_totals.html"   # manual browser save
BBALLREF_CACHE_NAME = "bballref_positions.json"        # parsed cache
BBALLREF_HEADERS = {...}  # browser-like headers for the best-effort scripted GET
```

The page is **Cloudflare-protected** (see §7). A browser-like `User-Agent` is configured for the fallback GET, but the canonical path is: a human saves the page once, the pipeline parses it offline forever.

---

## 4. Stage 1 — `fetch.py`: the network stage in detail

### 4.1 The call plan (38 nba-api calls + 1 best-effort)

| # | Endpoint (nba-api class) | Save target | Why we need it |
|---|---|---|---|
| 1 | `CommonAllPlayers(is_only_current_season=1)` | `all_players.csv` | canonical name/slug identity, every rostered player |
| 30 | `CommonTeamRoster(team_id=…)` | `rosters/{ABV}.csv` | official **G/F/C** position, height, slug |
| 1 | `LeagueDashPlayerStats(measure="Base")` | `player_stats_base_totals.csv` | all season totals + league FG%/FG3%/FT% |
| 1 | `LeagueDashPlayerStats(measure="Advanced")` | `player_stats_advanced_totals.csv` | `USG_PCT`, `OREB_PCT`, ratings |
| 1 | `LeagueDashPlayerClutch` | `player_clutch_totals.csv` | performance in last-5-min/±5-point situations |
| 2 | `LeagueDashPlayerStats(starter_bench="Starters"/"Bench")` | `player_stats_{starters,bench}_totals.csv` | per-player starter vs bench minutes |
| 2 | `LeagueDashTeamStats(measure="Base"/"Advanced")` | `team_stats_*_totals.csv` | team totals, pace, ratings |
| 1 | Basketball-Reference GET (best-effort, usually 403) | `bballref_nba_2026_totals.html` | classic 5-position taxonomy — see §7 |

### 4.2 `_call` — the throttle + retry wrapper

```python
def _call(factory, **kwargs) -> pd.DataFrame:
    last_err = None
    for attempt in range(config.RETRIES):
        try:
            time.sleep(config.SECONDS_BETWEEN_CALLS)        # throttle BEFORE every request
            res = factory(season=config.SEASON, timeout=config.TIMEOUT_S, **kwargs)
            frames = res.get_data_frames()
            if not frames:
                raise FetchError("endpoint returned no data frames")
            return frames[0]                                 # first data frame only
        except Exception as err:                             # retry every failure class
            last_err = err
            wait = config.BACKOFF_BASE_S * (2 ** attempt)    # 2s, 4s, 8s…
            print(f"  ! attempt {attempt + 1} failed ({err}); retrying in {wait}s")
            time.sleep(wait)
    raise FetchError(f"gave up after {config.RETRIES} attempts: {last_err}")
```

Three deliberate choices:

1. **Sleep *before* the request, not after** — a failed call still counts as a hit, so sleeping first keeps the request cadence even across retries.
2. **Catch everything** (`except Exception`, with `noqa: BLE001`) — a 429, a 504, a timeout, a connection reset: all are transient from the caller's perspective; retry all.
3. **First data frame only** — `nba_api` endpoints return a dict of named frames as a list; the pipeline consistently wants the first (the header/aggregate frame).

### 4.3 The cache-first fetch helpers

Every `fetch_*` function follows the same shape — the file is the source of truth:

```python
def fetch_all_players(refresh: bool) -> pd.DataFrame:
    path = config.RAW_DIR / "all_players.csv"
    if path.exists() and not refresh:          # cache hit: read, no network
        return pd.read_csv(path)
    df = _call(CommonAllPlayers, is_only_current_season=1)
    _save(df, path)                            # verbatim CSV, then read back
    return df
```

`_save` prints `saved {n} rows -> path`, makes parent dirs, and `pd.to_csv(…, index=False)`.

**Graceful degradation** — `fetch_team_rosters`:

```python
for team in get_teams():          # id → abbreviation map from nba_api.stats.static.teams
    abv = team["abbreviation"]
    ...
    try:
        df = _call(CommonTeamRoster, team_id=team["id"])
    except FetchError as err:
        missing.append((abv, str(err))); continue
    df["TEAM_ABBREVIATION"] = abv              # tag each team's frame so concat stays traceable
    frames.append(df)
frames = pd.concat(frames, ignore_index=True)
```

A single team failing to fetch must not kill the pipeline: the error is collected, the other 29 load, and a re-run later fills the gap.

### 4.4 The raw dict — the internal contract between Stage 1 and Stage 2

Both `fetch_all()` and `load_raw_from_disk()` return the same shape, so Stage 2 is agnostic to where the data came from:

```python
raw = {
  "all_players":         DataFrame (PERSON_ID, DISPLAY_FIRST_LAST, PLAYER_SLUG, …),
  "rosters":             concat of 30 roster frames, tagged with TEAM_ABBREVIATION,
  "player_stats":        {"base": …, "advanced": …},
  "clutch":              DataFrame,
  "starter_bench":       {"starters": …, "bench": …},
  "team_stats":          {"base": …, "advanced": …},
  "bballref_positions":  {normalized_name: {"name_display", "position5", "raw_pos"}},
}
```

### 4.5 `load_raw_from_disk` — the read-only twin, for `--no-fetch`

The offline path verifies **every** required file exists up front and fails with the exact list of what's missing:

```python
needed = {"all_players": …, "rosters_dir": …, "player_base": …, "player_advanced": …,
          "clutch": …, "starter": …, "bench": …, "team_base": …, "team_advanced": …}
missing = [str(p) for p in needed.values() if p.exists() is False]
if missing:
    raise FileNotFoundError("raw cache incomplete, run without --no-fetch first: …")
```

It also re-assembles the rosters frame from the 30 roster files (tagging each with `TEAM_ABBREVIATION = p.stem`), exactly matching what `fetch_all` would produce — and pulls bball-ref positions from the **JSON cache** (`bballref.load(refresh=False)`), so `--no-fetch` is fully offline.

---

## 5. `normalize.py` — the tiny shared helpers

Four functions, each with a story:

**`ascii_slug(value)`** — the identity normalizer used for names → `player_id`s:

```python
text = unicodedata.normalize("NFKD", str(value))   # decompose diacritics
text = "".join(ch for ch in text if not unicodedata.combining(ch))  # strip them
text = re.sub(r"[^a-z0-9]+", "_", text.lower().strip())             # non-alnum → _
return text.strip("_")
```

`'lebron-james' → 'lebron_james'`, `'kristaps-porziņģis' → 'kristaps-porzingis'`. (NFKD decomposition + combining-char removal is the "correct" way to strip accents; `unidecode` would also work but this avoids the dependency.)

**`parse_height_inches(height)`** — the NBA roster API reports height as `"6-9"`; this parses it to inches (81.0), returning `None` for unknown. It tolerates `'`/`"` feet-inches notation too, and gracefully returns `None` on any parse error (`ValueError`/`IndexError`).

**`safe_div(n, d, default=0.0)`** — division that never hits `ZeroDivisionError` and treats non-positive denominators as "no data → default". This wraps *every* rate computation in the pipeline. It exists because pandas `fillna` can't catch a denominator of 0 at the point where the fraction is written.

**`league_possessions_per_game(player_totals, team_games)`** — the uniform defensive denominator (the famous **113.2 possessions**):

```python
total_poss = (player_totals["FGA"] + 0.44 * player_totals["FTA"] + player_totals["TOV"]).sum()
return safe_div(total_poss, team_games, default=100.0)
```

Why summing **player** totals and dividing by **team-games**? Each team's possession flow is counted exactly once per game when you sum its players' `FGA + 0.44·FTA + TOV`; dividing by the true number of team-games (`30 teams × GP`, e.g. 2,460) gives one team's possessions per game *league-wide*. Every player's defensive rates share this single denominator, so rates are comparable across players regardless of team tempo.

---

## 6. Stage 2 — `derive.py`: the offline derivation, step by step

This is the meat. `derive(raw)` orchestrates five building blocks:

```
derive(raw)
 ├─ 1. _build_master(raw)        one row per player: identity + positions + all raw numbers
 ├─ 2. _team_lookup(raw)         one row per team: per-game aggregates + pace/ratings
 ├─ 3. _derive_attributes(...)   the 12 attributes (the formulas)
 ├─ 4. _build_players_json / _build_teams_json   final JSON structures
 ├─ 5. schemas.validate_processed_output(...)    CONTRACT GATE — before any write
 └─ writes: players.json, teams.json, data_quality.json, attributes_table.csv
```

### 6.1 Setup and shared helpers

```python
FLOAT_COLS = ["FGM","FGA","FG3M","FG3A","FTM","FTA","OREB","DREB","REB","AST",
              "TOV","STL","BLK","PF","PFD","PTS","MIN","GP","AGE"]
```

**Why this list exists:** `nba_api` CSVs sometimes come back with stats as strings (or as mixed types); pandas would then produce `object` columns where arithmetic silently misbehaves. Every column in `FLOAT_COLS` is force-coerced with `pd.to_numeric(..., errors="coerce").fillna(0.0)`.

```python
def _ensure(df, col, default=0.0):
    """Make sure a column exists, defaulting it to 0.0."""
    return df.assign(**{col: default}) if col not in df.columns else df

def _unique_id(df, col, keep):
    """Dedupe a table on PLAYER_ID, keeping the row with the highest `keep` (e.g. MIN)."""
    return df.sort_values(keep, ascending=False).drop_duplicates("PLAYER_ID", keep="first").reset_index(drop=True)
```

**Why dedupe on `MAX(MIN)`:** a traded player appears **once per team** in `LeagueDashPlayerStats`. We want *one* row per player representing his season, and the club he played the most minutes for is his "real" team. Sorting by minutes descending and taking the first duplicate is a clean way to do that without a groupby.

### 6.2 `_build_master(raw)` — the big join, in order

Everything below operates on `merged`, grown merge by merge (all `how="left"` on `PLAYER_ID`).

**Step 1 — season totals.** `player_stats.base` deduped by max minutes; `FLOAT_COLS` coerced. Then **zero-minute players are dropped**:

```python
played = base[base["MIN"] > 0].copy()
```

This is the pipeline's scope policy: a player who never logged a minute (injured all season, two-way stash) has no meaningful rates and never enters `players.json` (≈5 current-roster players each season).

**Step 2 — identity from `CommonAllPlayers`.** Remap `PERSON_ID → PLAYER_ID`, `DISPLAY_FIRST_LAST → NAME`, `PLAYER_SLUG → SLUG`; dedupe keeping first. This is the canonical name source because it covers every rostered player.

**Step 3 — roster facts (position + height) from the roster files.** `CommonTeamRoster` gives the official **G/F/C** label (`POSITION`), `HEIGHT`, and a slug. Drop duplicates, keep first. Players without a roster row get `POSITION = "X"` later. Note the deliberate rename `PLAYER → ROSTER_NAME` — the roster file's name column is kept out of the merge so the identity join doesn't mix name sources.

**Step 4 — `position5` from Basketball-Reference.** The classic **PG/SG/SF/PF/C** role is read from the `{"normalized name": {"position5": …}}` dict:

```python
lookup = {k: v["position5"] for k, v in positions.items()}
for our_norm, ref_norm in bballref.NAME_ALIASES.items():   # manual aliases
    if ref_norm in lookup and our_norm not in lookup:
        lookup[our_norm] = lookup[ref_norm]
nba_norm = merged["NAME"].map(lambda n: bballref.normalize_name(str(n)))
merged["position5"] = [lookup.get(n, "X") for n in nba_norm]
```

The aliases are applied *into* the lookup dict (our normalized name → ref's entry) so generic name normalization + explicit overrides share one join path. Unmatched players get `"X"` (currently **0 missing** — every one of the 582 matched). See §7 for the parser.

**Step 5 — starter vs bench minutes.** `is_starter` is not in the official roster data either; stats.nba.com *does* publish each player's minutes split into starter vs bench games. The same players can appear in both splits, so:

```python
merged["ST_MIN"] = merged["PLAYER_ID"].map(_split_min("starters")).fillna(0.0)
merged["BE_MIN"] = merged["PLAYER_ID"].map(_split_min("bench")).fillna(0.0)
merged["is_starter"] = merged["ST_MIN"] >= merged["BE_MIN"]
```

(2025-26 result: **216 starters / 366 bench**.)

**Step 6 — the canonical team (the subtle one).** The team a player is attached to comes from the **stats table's `TEAM_ABBREVIATION`**, *not* from the roster files:

```python
merged["TEAM_ID_ROSTER"] = merged["TEAM_ABBREVIATION"]
```

Why? Roughly **57 players were waived/traded mid-season**: they have a full season-stats row but no current-roster row. If teams were sourced from the roster files, those players would have no team — and `teams.json` rosters would break referential integrity in both directions. Giving everyone the club he logged his minutes for means:
- every player has exactly one `team_id` that exists in `teams.json`,
- every roster entry in `teams.json` is a real player in `players.json`,
- membership agrees both ways — **by construction**.

The roster files are still used — for `POSITION`, `HEIGHT`, and slug fallback — just not for membership.

**Step 7 — identity fallbacks for unrostered (waived) players**, in order: full game name → roster slug → raw name:

```python
merged["NAME"] = merged["NAME"].fillna(merged["PLAYER_NAME"])
merged["SLUG"] = merged["SLUG"].fillna(merged["ROSTER_SLUG"]).fillna(merged["NAME"])
merged["POSITION"] = merged["POSITION"].fillna("X")
```

**Step 8 — `player_id` slugs, guaranteed unique.** `player_id = ascii_slug(SLUG)`, then a manual dedupe loop appends suffixes:

```python
used = {}
for i, pid in enumerate(merged["player_id"]):
    n = used.get(pid, 0)
    if n:
        merged.loc[i, "player_id"] = f"{pid}_{n + 1}"
    used[pid] = n + 1
```

Identically-named players get `_2`, `_3`, … — this matters because `player_id` is the *key* used by team rosters and the engine. Also: `merged["team_id"] = merged["TEAM_ID_ROSTER"].str.lower()` — lowercase slugs as ids (files use `"lal"`, joins use uppercase `"LAL"`).

**Step 9 — clutch context.** `LeagueDashPlayerClutch` (stats when the game is within 5 points in the last 5 minutes) deduped and merged as `CL_FGM`/`CL_FGA`, defaulting to `0.0`. Zero clutch minutes ⇒ neutral `clutch_factor = 0.5` later.

**Step 10 — advanced + league shooting columns.** `USG_PCT`, `PACE`, `OFF_RATING`, `DEF_RATING`, `OREB_PCT` come from Advanced. The league's own `FG3_PCT` and `FT_PCT` are renamed to `ENDP_FG3_PCT` / `ENDP_FT_PCT` — the `ENDP_` prefix makes it impossible to confuse "the league's number" with the derived column of the same concept later.

### 6.3 `_team_lookup(raw)` — per-team aggregates

```python
id_to_abv = {t["id"]: t["abbreviation"] for t in get_teams()}
```

- Base + advanced team totals both get `FLOAT`-style coercion for a shared column list.
- `PACE`, `OFF_RATING`, `DEF_RATING` are overwritten from the **advanced** frame when present (the base frame's version is the same concept; advanced is authoritative).
- `team_id = abbreviation.lower()` (join key for players), `team_abv` stays uppercase.
- **`makes_pg = FGM / GP`** — team made-baskets per game. `FGM` *includes* three-pointers, so this is total makes per game; never add `FG3M` again.

### 6.4 `_derive_attributes` — the formulas (the interesting part)

**League context, computed once** from the full player-totals table:

```python
avg2 = Σ(FGM − FG3M) / Σ(FGA − FG3A)     # league 2pt make rate
avg3 = Σ(FG3M) / Σ(FG3A)                  # league 3pt rate
avgf = Σ(FTM) / Σ(FTA)                    # league FT rate
team_games = int(teams["GP"].sum())       # 30 × GP team-games
team_poss_pg = league_possessions_per_game(player_totals, team_games)   # ≈ 113.2
```

**Per-player mechanics** (code-level):

```python
m["min_pg"]   = m["MIN"] / m["GP"]
m["min_frac"] = np.clip(m["min_pg"] / 48.0, 0.0, 1.0)        # share of a regulation game
m["own_poss"] = m["FGA"] + 0.44 * m["FTA"] + m["TOV"]        # his own possessions
```

Then each attribute — I'll group them the way the presentation does:

**Shooting (3).** `two_pt_pct`, `three_pt_pct`, `ft_pct` are the league's *columns* where they exist (`FG3PCT`, `FTPCT`), and a hand-built split where they don't (there is **no league 2PT% column** — `FG_PCT` counts every 3-pt attempt, so 2PT% must be split from the components `FGM−FG3M ÷ FGA−FG3A`). All three are **shrunk** toward the league mean with 10 pseudo-attempts:

```python
m["two_pt_pct"] = np.where(m["_2pa"] > 0, (m["_2pm"] + K*avg2)/(m["_2pa"] + K), avg2)
m["three_pt_pct"] = np.where(m["FG3A"] > 0, (m["FG3M"] + K*avg3)/(m["FG3A"] + K), avg3)
m["ft_pct"] = np.where(m["FTA"] > 0, (m["FTM"] + K*avgf)/(m["FTA"] + K), avgf)
```

A 3-attempt player who went 3/3 gets pulled near the league mean; a 600-attempt star keeps almost exactly his real number. Players with zero attempts get the league mean directly (the `np.where` guard).

**Ball handling & defense (4).** `turnover_rate`, `foul_rate`, `steal_rate`, `block_rate`.

```python
m["turnover_rate"] = (m["TOV"] / m["own_poss"]).fillna(0.0).clip(upper=0.5)
```

Turnovers per *his own* possession. `.clip(upper=0.5)` is a sanity ceiling — nobody turns it over more than half the time.

```python
m["def_poss_pg"] = team_poss_pg * m["min_frac"]
m["foul_rate"]  = (m["PF"]  / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)
m["steal_rate"] = (m["STL"] / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)
m["block_rate"] = (m["BLK"] / m["GP"] / m["def_poss_pg"]).fillna(0.0).clip(0.0, 1.0)
```

The conceptual point worth making in a presentation: **a defender faces the whole opponent's possession flow while on court**, so per-game event counts are divided by *his* defended possessions per game = league possessions × his share of the game (minutes/48). A 12-minute bench player therefore doesn't look like a foul machine just because he only plays a quarter.

**Rebounding & playmaking (2).** `rebound_rate`, `assist_rate`.

```python
m["rebound_rate"] = m["OREB_PCT"].clip(0.0, 1.0)   # league's own offensive-rebound %
```

`OREB_PCT` is the league's own offensive-rebound percentage (offensive boards ÷ available opportunities). An early draft hand-rolled `OREB ÷ (team misses × minutes share)`; the league's own number won because their opportunity denominator is more correct (and it also removed the minutes-scaling subtlety).

```python
own_makes_pg = m["FGM"] / m["GP"]
teammate_makes_pg = (m["makes_pg"] - own_makes_pg).clip(lower=0.5)
m["assist_rate"] = (m["AST"] / m["GP"] / teammate_makes_pg).fillna(0.0).clip(0.0, 1.0)
```

Assists per *teammate made basket* — the natural "how much did he set his teammates up" rate. `FGM` already includes 3s, so teammate makes = `team FGM/GP − own FGM/GP`; the `.clip(lower=0.5)` floor prevents a teammate-less denominator blowup. (There was a real bug in an earlier draft that added `FG3M` back into the denominator, inflating it ~15% and understating playmakers — documented in `statistics.md` §5.)

**Effort & intangibles (3).** `stamina`, `clutch_factor`, `usage_rate`.

```python
age_penalty = 0.05 * np.clip((m["AGE"] - 34.0) / 10.0, 0, 2)   # 0.5%/year above 34, capped
m["stamina"] = (0.55 + 0.45 * np.clip(m["min_pg"] / 38.0, 0.0, 1.0) - age_penalty).clip(0.0, 1.0)
```

Minutes/game is the endurance signal (the 0.45 bonus saturates at 38 min/game); age adds a small durability penalty, capped so it can't drive stamina negative.

```python
overall_fgp  = np.where(m["FGA"] > 0, m["FGM"] / m["FGA"], 0.0)
clutch_fgp   = np.where(m["CL_FGA"] > 0, m["CL_FGM"] / m["CL_FGA"], np.nan)
clutch_delta = np.where(np.isnan(clutch_fgp), 0.0, clutch_fgp - overall_fgp)
clutch_weight = np.clip(m["CL_FGA"] / 50.0, 0.0, 1.0)          # 50+ clutch FGA → full weight
m["clutch_factor"] = np.clip(0.5 + 2.0 * clutch_delta * clutch_weight, 0.0, 1.0)
```

Clutch = how much *better* the player shoots in the final-5-minutes/±5-points than his season average, neutral 0.5 if he never plays clutch, and **weighted by sample size** so a 3-attempt "clutch run" can't manufacture a 0.99.

```python
m["usage_rate"] = np.clip(m["USG_PCT"], 0.0, 1.0)   # league's own USG%, as-is
```

### 6.5 Building the JSON outputs

`ATTRS` is the canonical ordered list of the 12 attributes (the order used in every file):

```python
ATTRS = ["two_pt_pct","three_pt_pct","ft_pct","turnover_rate","foul_rate",
         "rebound_rate","assist_rate","steal_rate","block_rate",
         "stamina","clutch_factor","usage_rate"]
```

**`_build_players_json`** — one dict per master row, sorted by `(team_id, NAME)`; each attribute `round(float(...), 4)`. Resulting row (real data):

```json
{
  "player_id": "asa_newell",
  "name": "Asa Newell",
  "team_id": "atl",
  "position": "F",
  "position5": "PF",
  "is_starter": false,
  "attributes": {
    "two_pt_pct": 0.649, "three_pt_pct": 0.3835, "ft_pct": 0.611,
    "turnover_rate": 0.1123, "foul_rate": 0.0551, "rebound_rate": 0.078,
    "assist_rate": 0.0142, "steal_rate": 0.0136, "block_rate": 0.0127,
    "stamina": 0.6845, "clutch_factor": 0.5, "usage_rate": 0.16
  }
}
```

**`_build_teams_json`** — one dict per team (sorted by `team_abv`); **rosters are built from the players table**, not from the roster files:

```python
player_ids = sorted(m.loc[m["TEAM_ID_ROSTER"] == abv, "player_id"].tolist())
```

*"Built from the players table"* is the sentence that makes referential integrity hold by construction (see §10). Real row:

```json
{
  "team_id": "atl",
  "name": "Atlanta Hawks",
  "abbreviation": "ATL",
  "roster": ["asa_newell", "buddy_hield", "caleb_houstan", …],
  "team_stats": {"pace": 102.5, "off_rtg": 115.0, "def_rtg": 112.9},
  "season": "2025-26"
}
```

Roster sizes range **16 (HOU) to 25 (MEM)** depending on how many players each franchise cycled through the season.

### 6.6 The contract gate

```python
schemas.validate_processed_output(players_json, teams_json)
```

This runs **before any `open(...)` write**. If it raises `SchemaValidationError`, the CLI catches it, prints `[error] derive output failed schema validation, nothing was written`, and exits 1 — the last known-good files stay on disk untouched. Defined in `schemas.py`, enforced here; see §8.

### 6.7 Writes + side outputs

```python
players.json         (indent=2, ensure_ascii=False — é/õ survive)
teams.json           (indent=2)
data_quality.json    (indent=2)
attributes_table.csv (58 columns: raw endpoint values + derived, one row per player)
```

`ensure_ascii=False` matters: player names like *Krisztián* / *Dário* must round-trip.

### 6.8 `_quality_report` — the sanity report

Every number below comes straight from the master table. Field-by-field in §11.

---

## 7. `bballref.py` — the manual artifact (positions)

### 7.1 The problem

stats.nba.com only publishes **G / F / C** (and combos like `G-F`, `F-C`). The simulator's classic taxonomy — **PG / SG / SF / PF / C** — does not exist in the official API. Basketball-Reference's league totals page lists every player with those classic positions; but the page sits behind a **Cloudflare challenge** that blocks scripted downloads (a scripted GET returns HTTP 403 with "Just a moment…").

Workflow (documented in `statistics.md` §7):
1. Open `https://www.basketball-reference.com/leagues/NBA_2026_totals.html` in a **browser**.
2. **Ctrl+S / ⌘S → "Webpage, HTML Only"** → save to `data/raw/2025_26/bballref_nba_2026_totals.html`.
3. The pipeline parses it offline and **caches the result as JSON** (`bballref_positions.json`), so offline re-derives never need the HTML again.

### 7.2 The parser — stdlib only

`_TableScanner(HTMLParser)` collects every `<tr>`'s cells from the **first** `<table>` in the page, using Python's standard-library `html.parser` (deliberately no lxml/bs4 dependency). It keeps a small state machine: `active` (inside table #0), `current_row`, `current_cell`; `handle_data` accumulates cell text; `handle_endtag` collapses whitespace into a single string.

`parse_positions(html)` then:
1. Finds the **header row** that contains both a `player` and a `pos` column.
2. For every data row: normalizes the name, takes the *primary* classic role out of cells like `SF-PF` (scan tokens split on `-/\s`, keep the first of `{PG,SG,SF,PF,C}`; anything else → skip, defensive).
3. Returns `{normalized_name: {"name_display", "position5", "raw_pos"}}`.

### 7.3 Name matching — the join that has to survive reality

`normalize_name(name)` bridges two different spellings of the same person:

```python
cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", name)   # "(TW)" / "(FA)" suffixes
slug = ascii_slug(cleaned.replace(".", ""))       # "A.J." -> "aj"
return SUFFIX_RE.sub("", slug)                    # Jimmy Butler III -> jimmy_butler
```

- parenthetical suffixes (`Jalen Hood-Schifino (TW)`) stripped;
- generational suffixes (`jr sr ii iii iv`) dropped — bball-ref writes "Jimmy Butler", stats.nba.com writes "Jimmy Butler III";
- periods in initials collapsed (`A.J. Green` ≡ `aj green`);
- diacritics dropped via `ascii_slug`.

And a tiny explicit alias map covers the few names generic normalization can't reconcile:

```python
NAME_ALIASES = {
    "trevon_scott": "tre_scott",        # nickname
    "ronald_holland": "ron_holland",    # nickname
    "adama_bal": "adama_alpha_bal",     # middle name
}
```

### 7.4 Refresh semantics (an important nuance)

`--refresh` does **not** re-download the bball-ref page (it can't — Cloudflare). For `bballref.py`, refresh means: **re-parse the locally saved HTML and rebuild the JSON cache**. The scripted GET fallback (browser-like headers, 15 s timeout) is only attempted when *no* local copy exists at all, and it's understood to usually fail — the user is then told exactly what to do. `derive()` **refuses to run without the positions** (it raises with save instructions), because `position5` is a required input, not optional.

---

## 8. `schemas.py` — the executable contract

This module converts the "contract" from a docstring into something the machine enforces. Everything in plan.md §2.1 — and everything a consumer might silently misread — becomes a Pydantic v2 model with validators.

### 8.1 The models

- **`PlayerAttributes`** — the 12 attributes, every field `Field(ge=0.0, le=1.0)` (`UNIT_RATE`). `model_config = {"extra": "forbid"}` — a typo'd extra key fails instead of being silently ignored.
- **`Player`** — `player_id`/`name`/`team_id` non-empty; `player_id` and `team_id` must match `_SLUG_RE = [a-z0-9]+(?:_[a-z0-9]+)*` (lowercase, underscore-separated); `position` must be in `VALID_POSITIONS = {"G","F","C","G-F","F-G","F-C","C-F","X"}`; `position5` in `{"PG","SG","SF","PF","C","X"}`; `is_starter` bool; `attributes: PlayerAttributes`.
- **`TeamStats`** — `pace` strictly positive; `off_rtg`/`def_rtg` floats.
- **`Team`** — `team_id` slug-shaped; `abbreviation` upper-case 2–4 chars; `roster` non-empty **and** duplicate-free; `season` non-empty.

### 8.2 The validators (aggregate, not fail-fast)

`validate_players` / `validate_teams` each loop over every dict, collect *all* failures into an `errors` list, and raise **once** with every problem listed (a bad upstream join usually produces many bad rows — seeing all of them in one error beats a crash-fix-rerun cycle per row). Duplicate ids are caught here too, via a `seen_ids` set.

### 8.3 Referential integrity — cross-table checks a single model can't express

```python
def validate_referential_integrity(players, teams):
    # every player.team_id must name a real team
    # every team.roster entry must name a real player
    # membership agrees BOTH ways: a player must also appear on his own team's roster
```

Because `derive` builds rosters *from* the players table (§6.5), these pass by construction — but they're still checked, because the contract is the contract, and because the same validator is reused by consumers on files that were **not** produced by `derive` (see §12).

### 8.4 The entry point

```python
def validate_processed_output(players_json, teams_json) -> tuple[list[Player], list[Team]]:
    players = validate_players(players_json)
    teams = validate_teams(teams_json)
    validate_referential_integrity(players, teams)
    return players, teams
```

Returns the validated Pydantic objects — the same objects the engine imports later.

---

## 9. The CLI — `__main__.py` (and the legacy alias)

```python
python -m app.data_ingestion            # fetch (once) + derive
python -m app.data_ingestion --no-fetch # derive only, from local raw cache (fails fast)
python -m app.data_ingestion --refresh  # force re-fetch of every raw dataset
```

- `--refresh` and `--no-fetch` are **mutually exclusive** → `parser.error(...)` (exit 2).
- `--no-fetch` → `load_raw_from_disk()`; otherwise → `fetch_all(refresh=args.refresh)`.
- `derive(raw)` wrapped in `try/except SchemaValidationError`: on failure prints `[error] derive output failed schema validation, nothing was written` to **stderr** and returns exit code **1**; on success prints `[ok] outputs under …/processed` and returns 0.
- `ingest_data.py` is a thin backward-compatible alias: it imports `main` from `__main__` and calls it — the same software, one historical entry point.
- `args = parser.parse_args(argv)` with `argv: list[str] | None` makes the CLI **testable** (the function takes the args instead of reading `sys.argv` directly).

`plan.md`-context note: the fetch stage is 38 throttled nba-api requests (~0.7 s apart + retry backoff → a couple of minutes on a cold run) plus one best-effort bball-ref GET; the derive stage is seconds.

---

## 10. Policy decisions that keep the data consistent (know these cold)

These are the two sentences that explain why `players.json` and `teams.json` agree *by construction*, and they make great presentation material.

**1. Zero-minute players are excluded.** `players.json` is scoped to "≥ 1 minute played" (582 in 2025-26). Roster entries are therefore also missing the ~5 current-roster players with zero minutes — they have no attributes and never play.

**2. A player's team is his *season* team** (the club he logged minutes for, from the stats `TEAM_ABBREVIATION`), not who he happens to be under contract with right now. The ~57 players waived mid-season keep their season team. Consequences:

- every player has exactly one `team_id` that exists in `teams.json`;
- every `team.roster` entry is a real player in `players.json`;
- `Σ roster_entries = players_with_stats = 582`.

Effects measured by the quality report: `zero_minute_roster_players_excluded = 5`, `stats_players_not_on_active_roster = 57`.

**History that validates the choice:** the previous implementation sourced rosters from the roster files, which broke the contract in *both* directions (5 roster entries without players, 57 players without roster entries) — invisible only because validation wasn't wired in yet. Turning the schema into an executable gate is what surfaced it.

---

## 11. `data_quality.json` — field by field (2025-26 actual values)

| Field | Value | Meaning |
|---|---|---|
| `players_with_stats` | 582 | players in `players.json` (≥1 min) |
| `teams` | 30 | teams in `teams.json` |
| `position_distribution` | G 212 / F 162 / C 57 / **X 57** / G-F 38 / F-C 28 / C-F 17 / F-G 11 | official NBA labels; the 57 `X` = players without a current-roster row (waived/traded) |
| `position5_distribution` | SG 162 / SF 111 / C 107 / PF 105 / PG 97 | classic positions from bball-ref |
| `position5_missing` | 0 | players stuck with `"X"` — all 582 matched bball-ref |
| `starters` / `bench_players` | 216 / 366 | from `ST_MIN >= BE_MIN` |
| `small_sample_lt10gp` | 76 | under `MIN_GP_FOR_SAMPLE_FLAG`(10) GP — their rates are shrinkage-heavy |
| `players_with_clutch_minutes` | 413 | have clutch FGA > 0; the other 169 get neutral 0.5 |
| `usage_missing_defaulted` | 0 | should be 0; would flag missing `USG_PCT` |
| `attribute_stats` | min/mean/max per attribute | e.g. `two_pt_pct` LAG 0.3276–0.7718 (mean 0.5446); `clutch_factor` 0.1066–0.7743 (mean 0.4831) |
| `rostered_but_zero_minutes_excluded` | 0 | `CommonAllPlayers` players without a stat row |
| `zero_minute_roster_players_excluded` | 5 | roster-file players with MIN = 0 (kept out of rosters) |
| `stats_players_not_on_active_roster` | 57 | stats players with no current-roster row (kept with their season team) |
| `roster_entries` | 582 | Σ rosters — must equal `players_with_stats` |

The report is the quick glance a human uses to confirm a re-derive didn't silently distort anything (e.g. `position5_missing` jumping from 0 to 40 means the bball-ref join broke).

---

## 12. How the rest of the codebase interacts with this module

This is the part you're presenting. There are exactly **four code-level consumers** today, plus the planned API flow. Here is the full map:

```
                    ┌────────────────────────────────────────────────────┐
                    │  data/processed/                                   │
                    │  players.json · teams.json                         │
                    └───────────┬────────────────────────┬───────────────┘
                                │                        │
              ┌─────────────────▼──────────┐  ┌──────────▼──────────────┐
              │  ENGINE (independent run)  │  │  DB SEED (operational)  │
              │  demo.py / visual_demo.py  │  │  db/seed.py             │
              │  ├─ load both JSONs        │  │  ├─ teams.json → Team   │
              │  └─ validate_processed_    │  │  │   rows (new UUIDs)   │
              │     output()  ◄─ schemas   │  │  └─ players.json →      │
              │  entities.py               │  │      Player rows with   │
              │  ├─ imports Player,Team,   │  │      attributes JSON    │
              │  │   PlayerAttributes from │  │       blob              │
              │  │   app.data_ingestion.   │  └──────────┬──────────────┘
              │  │   schemas               │             ▼
              │  └─ LivePlayer.from_       │        PostgreSQL (Team/Player)
              │     player(...)            │        │ (catalog API planned:
              │  heuristics/state_machine/ │        │  Team Locker UI)
              │  match_runner consume      │        │
              │  attributes as probabilities│        │
              └────────────────────────────┘        ▼
```

### 12.1 The engine — `app/engine/entities.py` (schema sharing)

The strongest "this is a real contract" moment: the engine **imports the ingestion module's schema classes at runtime**:

```python
from app.data_ingestion.schemas import Player, PlayerAttributes, Team
```

`LivePlayer.from_player(player: Player)` copies `player_id`, `name`, `team_id`, `position`, `position5`, `is_starter`, and the whole `attributes` object into a mutable runtime entity, and seeds `current_stamina` **from `attributes.stamina`** — the 0–1 scale means "starting energy" and the game-event probability are the same number.

`LiveTeam.from_team_and_players(team: Team, player_models: list[Player])`:
- filters all players by `p.team_id == team.team_id` (matching on the lowercased ids ingestion produced);
- picks the **5 starters** from `is_starter` (the catalog says who starts);
- completes a short starter list with bench players, ordering the bench by `team.roster` order;
- `select_ball_handler` weights on-court players by `usage_rate` (with a `max(0.01, …)` floor).

So a single field like `is_starter` (derived from the starter/bench minute split in §6.2) directly decides lineups, and `usage_rate` decides who brings the ball up.

### 12.2 The engine demos — `demo.py` & `visual_demo.py` (validator reuse)

Both demos load the processed files and run them through **the ingestion module's own validator** before starting:

```python
from app.data_ingestion.schemas import validate_processed_output
def load_data():
    players_json = json.load(open("data/processed/players.json"))
    teams_json   = json.load(open("data/processed/teams.json"))
    return validate_processed_output(players_json, teams_json)
```

This is the contract gate doing double duty: it protects the pipeline at write time *and* protects the consumer at read time — a hand-edited or stale `players.json` can't accidentally break a demo silently. `demo.py` then picks `lal` vs `bos`, runs `MatchRunner(home, away)` (seeded `random.Random(42)`, deterministic), and prints the final score + possession count.

### 12.3 The engine heuristics — how each attribute becomes a probability

`app/engine/heuristics.py` + `state_machine.py` + `match_runner.py` form the runtime that consumes the attributes. Reference table (every attribute appears in the probability math):

| Ingested attribute | Engine usage (function) |
|---|---|
| `usage_rate` | `select_ball_handler` / `resolve_pass_teammate` — RNG-weighted teammate choice (`rng.choices(weights=[…usage_rate…])`) |
| `two_pt_pct` / `three_pt_pct` | `resolve_shot` — `is_made = rng.random() < base_pct`; the court grid's `is_three_pointer()` picks which of the two applies |
| `stamina` | `resolve_shot` — `current_stamina < 0.40` applies a fatigue penalty; `LivePlayer.record_minutes` decays stamina ~0.0005/s on court |
| `clutch_factor` | `resolve_shot` — Q4 & score diff ≤ 5: `(clutch_factor − 0.5) × 0.12` shift on shot probability |
| `turnover_rate`, `steal_rate` | `resolve_pass_outcome` / `resolve_move_outcome` — turnover probability = `min(0.35, max(0.04, to_rate×0.7 + avg_steal×1.5))`; who intercepts weighted by `steal_rate` |
| `foul_rate`, `steal_rate` | `resolve_move_outcome` — IDLE roll: 10% foul (weighted by `foul_rate`), 8% strip (weighted by `steal_rate`) |
| `rebound_rate` | `resolve_rebound` — offensive rebound weights `rebound_rate`, defensive side gets a (0.15 + …) formula (function exists; note in current engine slice the state machine doesn't call it yet) |

Because every attribute is a **0–1 rate**, the engine treats them uniformly: `rng.random() < p` for a binary outcome, `rng.choices(players, weights=attrs)` for "who does it". That single design decision — *"the data contract's scale is the engine's probability scale"* — is the strongest presentation point in the whole project.

### 12.4 The database seed — `app/db/seed.py` → PostgreSQL

```python
DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"
teams_raw   = json.loads((DATA_DIR / "teams.json").read_text())
players_raw = json.loads((DATA_DIR / "players.json").read_text())
```

Note the same trust in the contract: the seed reads the **files**, not a re-derivation, and it maps slug `team_id` → fresh UUIDs:

- creates a `Team` row per entry (`id=uuid4()`, `name`, `team_id_to_db_id[team_id] = team.id`),
- creates a `Player` row per entry: `team_id=db_team_uuid`, `name`, and **`attributes=entry["attributes"]` stored verbatim as a JSON column** (SQLAlchemy `JSON`, `nullable=False`),
- **idempotent**: if any teams already exist it prints "Catalog already seeded – skipping" and returns — no accidental doubles.

The DB models (`db/models/player.py`, `team.py`) mirror the contract voluntarily: `Player.attributes: Mapped[dict] = mapped_column(JSON, …)`. The JSON blob keeps the file schema and the database in agreement **without a hard migration** — a new attribute in `players.json` flows straight into PostgreSQL. This is an operational step run manually (`python -m app.db.seed`), separate from `bootstrap.sh` (which only does `alembic upgrade head`).

### 12.5 API / frontend (current + planned)

Today the FastAPI layer (`api/factories.py`, domain services, `POST /sessions`) deals with sessions/users only; it does **not** read the catalog. The planned flow (per `ARCHITECTURE.md`): the seeded `Team`/`Player` tables feed a **catalog API** that the **Team Locker UI** screen reads — with attributes rendered from the JSON blob. The frontend currently uses mock data, so this hop is future work — but the contract has been stable since the seed, which is the point of building it this way.

### 12.6 Doc-level consumers

`plan.md` §2.1 (the original contract spec), `docs/data_ingestion.md` (machinery), `docs/statistics.md` (formulas), `ARCHITECTURE.md` (system wiring), `presentation_data_ingestion.md` (talk script) — and the `Makefile` (`format`/`bootstrap`/etc. don't invoke ingestion; it stays an explicit operational command).

---

## 13. Trace one player end-to-end (presentation example)

Follow **Asa Newell** (Atlanta) from raw API to the JSON:

1. **`CommonAllPlayers`** row: `PERSON_ID` numeric, `DISPLAY_FIRST_LAST = "Asa Newell"`, `PLAYER_SLUG = "asa-newell"`, team ATL.
2. **`CommonTeamRoster(atl)`** row: official `POSITION = "F"`, `HEIGHT = "6-9"` → `height_in = 81.0`.
3. **`LeagueDashPlayerStats(Base)`** row: 1,955 MIN, GP, all counts → survives the `MIN > 0` filter; **Advanced** row gives `USG_PCT = 0.16`, `OREB_PCT = 0.078`.
4. **bball-ref** totals page row "Asa Newell", `Pos = PF` → `normalize_name` → `asa_newell` → `position5 = "PF"`.
5. **Starters/bench split**: he has more bench than starter minutes → `is_starter = false` (matches the JSON sample in §6.5).
6. **`_derive_attributes`**: raw 2PT = `(FGM−FG3M)/(FGA−FG3A)`; shrunk with `K=10` and `avg2≈0.55` → `two_pt_pct = 0.649`; `ft_pct` shrunk toward 0.783 → 0.611; stamina from min_pg and age; clutch from clutch-FGA (he has clutch minutes → real delta, here neutral-ish).
7. **Gate**: `validate_processed_output` passes (range, slug, roster membership — ATL's roster includes `asa_newell`).
8. **Engine**: `LiveTeam.from_team_and_players` puts him on ATL's bench; if he gets on court, `usage_rate 0.16` weights his chance to handle, `two_pt_pct 0.649` his midrange conversion, `stamina 0.6845` his fatigue curve.
9. **DB**: `db/seed.py` turns him into a `Player` row with his 12 attributes as a JSON blob.

Every number in his JSON can be traced to a specific row in a specific CSV — that traceability is what the module was built to preserve.

---

## 14. Running the pipeline — every mode

```bash
# 1) full cold run: fetch 38 endpoints (throttled) + bball-ref fallback, then derive
.venv/bin/python -m app.data_ingestion

# 2) offline re-derive from the raw cache (fails fast listing missing files)
.venv/bin/python -m app.data_ingestion --no-fetch

# 3) force re-download of every raw dataset (bball-ref HTML is re-parsed, never re-downloaded)
.venv/bin/python -m app.data_ingestion --refresh

# legacy alias, identical behavior
.venv/bin/python -m app.data_ingestion.ingest_data --no-fetch
```

Typical new-season flow: save the bball-ref page once in a browser → run (no flags) → fetch fills `data/raw/` → derive validates and writes `data/processed/`. Subsequent runs: `--no-fetch`.

---

## 15. Failure modes (the table to memorize)

| Symptom | Cause | Fix |
|---|---|---|
| `raw cache incomplete … run without --no-fetch first: <paths>` | `--no-fetch` with missing CSVs | run without `--no-fetch` once, or restore files |
| `Basketball-Reference position data is required …` | no `bballref_positions.json` and no saved HTML | save the page once in a browser (see §7) and re-run |
| `derive output failed schema validation, nothing was written` (exit 1) | a row violates the contract (out-of-range attribute, dup id, broken roster link) | error lists every record; fix upstream data or formula; re-run |
| `gave up after 4 attempts: …` | endpoint throttled/unreachable through all retries | wait and re-run — cached files are reused |
| `! roster fetch failures: [(abv, err)]` | one team's roster call failed | other 29 load; re-run later to fill the gap |
| `! bball-ref returned HTTP 403 …` | Cloudflare block on scripted GET (only when no local page exists) | manual browser save once |
| seed: `Catalog already seeded … skipping` | `db/seed.py` idempotence | delete `teams` rows first if you want a re-seed |

---

## 16. Q&A prep — likely questions and the answers in this codebase

**Q: Why is the data cached at all? Why not just call the API per request?**
The engine runs headless simulations, not live stat lookups: it needs one consistent, reproducible snapshot. Caching raw responses verbatim makes every re-derive offline, deterministic, and free — and keeps us polite to stats.nba.com (0.7 s throttle, 4 retries, backoff).

**Q: Why two position fields (`position` and `position5`)?**
`position` is the official NBA label (G/F/C + combos) from `CommonTeamRoster`; `position5` is the classic PG/SG/SF/PF/C taxonomy the simulator lineups want, which the NBA API doesn't publish — it comes from Basketball-Reference (manual save, Cloudflare workaround) and is joined by normalized name.

**Q: Why 0–1 everywhere?**
So the attribute *is* the probability: `rng.random() < two_pt_pct`, `rng.choices(players, weights=usage_rate)`. One scale for data and simulation, enforced by `schemas.py` (`ge=0.0, le=1.0`).

**Q: What happens when a run fails mid-way?**
The contract gate validates **in memory before any write**, so a failing run never overwrites `players.json`/`teams.json` — it prints every problem and exits 1. Partially fetched raw files are fine: cached files are simply reused next run.

**Q: What about small samples / players nobody has heard of?**
Shrinkage: all three shooting rates pull toward league mean with 10 pseudo-attempts (`SHRINKAGE_K`), and clutch is sample-weighted (`CL_FGA / 50`). Players under 10 GP are flagged in the quality report.

**Q: Do the engine and the database know about this contract?**
Yes — literally. `engine/entities.py` imports `Player`/`Team`/`PlayerAttributes` from `app.data_ingestion.schemas`, and both demos re-validate loaded files with `validate_processed_output()`. The DB stores `attributes` as a JSON column via `db/seed.py`, so the file and the database agree without a migration.

**Q: Can I retrain / re-derive my own league?**
Everything tunable is in `config.py`; change a knob, run `--no-fetch`, diff `players.json`/`data_quality.json`. Change `SEASON` and re-run the full pipeline. The formulas are documented in `statistics.md` with worked examples.

---

## 17. Cheat sheet — the facts to throw around during a presentation

- **582 players, 30 teams, 12 attributes, all 0–1**, 2025-26 **regular season**.
- **Two stages**: 38 throttled nba-api calls → verbatim CSV cache → offline pandas derive.
- **Contract**: `players.json` / `teams.json` per plan.md §2.1, enforced by `schemas.py` before write and at read.
- **Pairs of numbers that tell the data-quality story**: 216 starters / 366 bench · 413 with real clutch minutes · 57 waived players kept with season team · 5 zero-minute roster players excluded · roster entries = players = 582 · position5 missing = 0.
- **Interesting formulas to cite**: league possessions per game ≈ 113.2 (Σ FGA + 0.44·FTA + TOV ÷ team-games); `two_pt_pct` split from components because league `FG_PCT` includes 3-pointers; defensive rates divide by *defended* possessions (possessions × minutes/48); `FGM` includes 3s (the assist-rate bug that was found and fixed); stamina = minutes model − age penalty; clutch = sample-weighted clutch FG% delta vs season FG%.
- **The one-line pitch**: *clean, validated, contract-enforced data in — a simulator that behaves like actual basketball out.*