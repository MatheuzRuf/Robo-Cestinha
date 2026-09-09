# Robo Cestinha — Predictive Basketball Simulator

Statistical basketball tournament simulator (MC 857 course project).

## Data Ingestion (NBA 2025-26)

Detailed stats & pipeline docs: [`docs/statistics.md`](docs/statistics.md)

```bash
# fetch raw season data from stats.nba.com (cached under data/raw/) + derive attributes
.venv/bin/python -m src.data_ingestion

# force a full re-fetch / re-derive offline from the local cache
.venv/bin/python -m src.data_ingestion --refresh
.venv/bin/python -m src.data_ingestion --no-fetch
```

Outputs (in `data/processed/`):

| File | Contents |
|---|---|
| `players.json` | 582 players with the 12 simulator attributes (+ `position5`, `is_starter`; see plan.md §2.1) |
| `teams.json` | 30 teams: rosters + pace / off/def ratings |
| `attributes_table.csv` | raw + derived per-player stats (used for ML features, Phase D) |
| `data_quality.json` | coverage & sanity report |

**How every statistic is computed: [`docs/statistics.md`](docs/statistics.md)** — formulas, worked examples, caveats (season scope, possession math, position & starter derivation).

**Classic positions (PG/SG/SF/PF/C):** the NBA only publishes G/F/C, so the classic 5 come from a Basketball-Reference page you save once from a browser (the site blocks scripts). See [`docs/statistics.md §7`](docs/statistics.md) for the 30-second setup.