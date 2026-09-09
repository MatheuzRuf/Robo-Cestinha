# Robo Cestinha — Predictive Basketball Simulator

Statistical basketball tournament simulator (MC 857 course project, by Team Robô
Cestinha). The high-level architecture and roadmap live in
[`plan.md`](plan.md) — this README covers the essentials for running and
understanding the project.

## Project scope (where things stand)

- **Goal:** single-elimination NBA-style tournaments simulated in-browser
  (Streamlit UI), driven by a possession-level state machine whose outcomes are
  resolved **heuristically from real player statistics** (no ML), with optional
  LLM narration and 2D court playback.
- **Status:** Phase A (schemas) and **Phase B (data ingestion) are done** — the
  pipeline described below produces the full 2025-26 player/team dataset.
  Engine, ML, and UI phases (C–J in `plan.md`) are not built yet.
- **Data scope:** NBA **2025-26 regular season**, 582 players, 30 teams.

## Environment & uv

The project is managed with **uv** (Python project manager). Python **3.14** is
pinned via [`.python-version`](.python-version) and cannot be changed by hand —
use `uv` to handle it.

```bash
# install the exact dependency set (creates/updates .venv from uv.lock)
uv sync

# run anything inside the project environment
uv run python -m src.data_ingestion
uv run python -c "import nba_api"

# add/remove a dependency (updates pyproject.toml + uv.lock)
uv add <package>
uv remove <package>
```

Notes:

- The venv is **gitignored**; `uv sync` regenerates it exactly. Everything is
  derived from [`pyproject.toml`](pyproject.toml) + [`uv.lock`](uv.lock).
- Dependencies: `nba-api` (import name is `nba_api`), `pandas`, `polars`,
  `pyarrow`, `ipython`/`ipykernel` (for the notebook).
- `.venv/bin/python` works too, but `uv run` is the canonical entry point.
- **No other runtime deps** — the scraper uses `requests` (via nba-api) and a
  stdlib-only HTML parser.

## Data ingestion pipeline (Phase B)

```bash
# Stage 1 (network) + Stage 2 (derive): fetch if needed, then build outputs
uv run python -m src.data_ingestion

# force a full re-fetch of every raw dataset from stats.nba.com
uv run python -m src.data_ingestion --refresh

# derive only, offline from the local raw cache (fails if the cache is incomplete)
uv run python -m src.data_ingestion --no-fetch
```

Two stages, deliberately split:

1. **Fetch** — ~38 throttled calls to `stats.nba.com` (made once), each
   response saved verbatim to `data/raw/2025_26/` as CSV.
2. **Derive** — pure offline pandas: joins rosters + season totals + clutch +
   starter/bench splits + Basketball-Reference positions into the final JSON.

Re-running is free: the raw cache is used unless `--refresh`. Tunables (season,
shrinkage, stamina curve, throttle) live in `src/data_ingestion/config.py`.

Outputs (in `data/processed/`, `data/raw/` is gitignored):

| File | Contents |
|---|---|
| `players.json` | 582 players, 12 simulator attributes (+ `position5`, `is_starter`; schema in plan.md §2.1) |
| `teams.json` | 30 teams: rosters + pace / off/def ratings |
| `attributes_table.csv` | raw + derived per-player stats (inputs for Phase D ML) |
| `data_quality.json` | coverage & sanity report (missing positions, distributions, ranges) |

## Quick reference

- **How every statistic is computed:** [`docs/statistics.md`](docs/statistics.md) —
  formulas, worked examples, caveats (season scope, possession math, position &
  starter derivation, endpoint-vs-derived decisions).
- **Classic positions (PG/SG/SF/PF/C):** the NBA only publishes G/F/C, so the
  classic 5 come from a Basketball-Reference page you save **once** from a
  browser (the site blocks scripts) into `data/raw/2025_26/`. The pipeline
  refuses to derive without it. 30-second setup: see
  [`docs/statistics.md §7`](docs/statistics.md).
- **Code layout:** the whole ingestion package is `src/data_ingestion/`
  (`fetch.py`, `derive.py`, `bballref.py`, `normalize.py`, `config.py`, `__main__.py`).
- **Notebook:** `exploration.ipynb` probes nba-api endpoints (Python 3.14 kernel).