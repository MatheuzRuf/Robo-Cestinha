# Presentation Script — Data Ingestion: How the Simulator Gets Real NBA Data

**Speaking time:** ~5:00 core (~5:30 with optional detail; deck has 9 slides)
**Audience:** MC 857 course project demo / architecture walkthrough
**Speakers:** Team Robô Cestinha
**Source material:** [`data_ingestion.md`](data_ingestion.md) (machinery), [`statistics.md`](statistics.md) (math), `backend/src/app/data_ingestion/` (code)

---

## Pacing cheat sheet (keep handy while presenting)

| # | Slide | Time budget | Cum. time |
|---|---|---|---|
| 1 | Title | 0:30 | 0:30 |
| 2 | Why ingestion is the foundation | 0:40 | 1:10 |
| 3 | The contract files we produce | 0:35 | 1:45 |
| 4 | The data contract & its consumers | 0:45 | 2:30 |
| 5 | The pipeline in two stages | 0:40 | 3:10 |
| 6 | Stage 1 — polite fetching | 0:40 | 3:50 |
| 7 | Stage 2 — raw numbers → attributes | 0:50 | 4:40 |
| 8 | The contract gate & quality report | 0:35 | 5:15 |
| 9 | Running it & closing | 0:20 | 5:35 |

Scripts are written at ~135 words/min. **To land at 5:00, cut the bracketed `[cut if over time]` sentences** on slides 4 and 7 (≈25 s saved total) and don't rush slide 9.

---

## Slide 1 — Title

**Time:** 0:00 → 0:30

**On the slide:**
- Title: *"Feeding the Simulator — How We Ingest Real NBA Data"*
- Team Robô Cestinha · MC 857 · 2026
- A small logo strip: `stats.nba.com` → data ingestion → `players.json` → engine
- Footer: *Repo: `backend/src/app/data_ingestion/`*

**Talk track:**

> Good morning. We're Team Robô Cestinha, and today we'll walk through the piece every other module depends on: data ingestion — how our simulator gets real NBA player statistics.
>
> The engine you saw earlier is purely heuristic: every shot, pass, and turnover is decided by a player's real attributes. So if the data feeding it is wrong, the whole simulation is wrong. Let's show you how we make sure it isn't.

---

## Slide 2 — Why data ingestion is the foundation

**Time:** 0:30 → 1:10

**On the slide:**
- One-line architecture strip: `NBA APIs + Basketball-Reference → Data Ingestion → players.json / teams.json → Simulation Engine → Live Broadcast`
- Highlight boxes: **582 players**, **30 teams**, **12 attrs per player**, **0–1 normalized**
- A classic data-problem list: inconsistent sources, missing values, small samples, two different roster definitions

**Talk track:**

> Here's the big picture. The whole product is a chain, and data ingestion is the first link. We pull player statistics from two sources — the NBA's official stats API, and Basketball-Reference for positions — and we turn them into two clean JSON files that the engine reads at match time.
>
> The numbers that matter: **582 players** from the 2025-26 regular season, across **30 teams**, each player carrying **12 simulator attributes** — things like two-point percentage, turnover rate, foul rate, stamina, and clutch factor.
>
> That might sound simple, but the raw data is messy. The two sources disagree about who's on which team, the NBA doesn't publish classic positions, small-sample players have noisy shooting percentages, and players get traded mid-season. Untangling all of that is what this module does.

---

## Slide 3 — The contract files we produce

**Time:** 1:10 → 1:45

**On the slide:**
- `players.json` — one object per player with name, team, classic position, `is_starter`, and the **12 attributes** grouped in four columns:
  - *Shooting:* two_pt_pct, three_pt_pct, ft_pct
  - *Ball handling & defense:* turnover_rate, steal_rate, block_rate, foul_rate
  - *Rebounding & playmaking:* rebound_rate, assist_rate
  - *Effort & intangibles:* stamina, clutch_factor, usage_rate
- `teams.json` — roster + pace, offensive rating, defensive rating
- Side outputs: `attributes_table.csv` (for ML/debugging), `data_quality.json` (sanity report)

**Talk track:**

> Our two main outputs are `players.json` and `teams.json`. Every attribute is normalized to a **0-to-1 scale**, which is a deliberate design choice: it maps one-to-one onto the probabilities the engine rolls against. If a player shoots 58% from two, the engine literally rolls a random number against 0.58.
>
> The attributes fall into four natural groups — shooting; ball handling and defense; rebounding and playmaking; and what we call effort intangibles: stamina, clutch, and usage. We also emit two bonus files: a flat table of every raw and derived stat for debugging and future ML work, and a machine-readable quality report. These four files aren't just outputs — they *are* the contract, as the next slide shows.

---

## Slide 4 — The data contract & its consumers

**Time:** 1:45 → 2:30

**On the slide:**
- Two-level contract diagram:
  - **Input contract** — `data_ingestion/schemas.py` (players.json / teams.json): the *only* way anyone may read the catalog
  - **Output contract** — `engine/schemas.py` (MatchLog: possessions, actions, box score, key moments): the *only* way the engine reports a match
- Consumer map:

```
players.json / teams.json ──► Engine (LivePlayer/LiveTeam — attributes → probabilities, is_starter → 5 starters)
                           ──► DB seed ──► PostgreSQL ──► catalog API ──► Team Locker UI (attributes as JSON blob)
MatchLog ──► 2D court visualization (possessions → frames)
         ──► Scoreboard / box score (UI)
         ──► LLM narration (key moments → commentary, planned)
         ──► MatchEvent / MatchFrameChunk (SSE live + replay, planned)
```

**Talk track:**

> The contract is what makes all of that safe, and it exists at **two levels**. The **catalog contract** — the Pydantic schemas in `data_ingestion/schemas.py` that define `players.json` and `teams.json` — is imported by every consumer; nothing reads these files ad hoc. The **match contract** — `engine/schemas.py` — defines the `MatchLog` the engine emits: possessions, actions, box scores, and key moments.
>
> And both contracts are consumed all over the app. The **engine** builds live players straight from the catalog — it literally imports the ingestion schemas — each attribute becoming an in-game probability, with `is_starter` picking the five starters. The **database seed** loads the same files into PostgreSQL, which the catalog API will serve to the Team Locker screen. *[cut if over time:] One detail: player attributes are stored as a JSON blob in the DB, so the file schema and the database agree without a hard migration.*
>
> The match contract drives the broadcast side: the 2D court turns possessions into frames, the scoreboard reads box scores, and the LLM turns key moments into narration — with live SSE streaming and replay built on top later.

---

## Slide 5 — The pipeline in two stages

**Time:** 2:30 → 3:10

**On the slide:**
- A big two-box diagram:

```
┌────────────── Stage 1: fetch ──────────────┐
│ stats.nba.com ──throttled, retried──► data/raw/2025_26/  (verbatim CSVs)
│ Basketball-Reference ──manual save──► bballref html     │
└──────────────────────┬────────────────────┘
                       ▼
┌────────────── Stage 2: derive ─────────────┐
│ offline pandas: master table → attributes  │
│ → schema validation (gate) → data/processed│
└──────────────────────┬────────────────────┘
                       ▼
              players.json · teams.json
```
- CLI: `python -m app.data_ingestion` · `--no-fetch` · `--refresh`

**Talk track:**

> The pipeline is deliberately split into two stages. **Stage one, fetch, touches the network** — about 39 polite calls to the NBA's stats API, each response saved verbatim to a local raw folder. **Stage two, derive, is completely offline** — pure pandas that joins all that raw data, computes the attributes, validates them against the schema contract, and only then writes the final files.
>
> That split is the whole trick. Because the raw data is cached on disk, re-running the pipeline costs nothing — we derive from the cache instead of re-hitting the network. You can even force an offline-only run with `--no-fetch`, which fails fast if anything is missing. The network is a one-time cost we pay once per season; everything after that is reproducible — and that's what makes this easy to demo live.

---

## Slide 6 — Stage 1: polite fetching

**Time:** 3:10 → 3:50

**On the slide:**
- The discipline list:
  - 39 calls: all players · 30 team rosters · per-player totals (base+advanced) · clutch splits · starters vs bench · team totals
  - 0.7 s between calls · up to 4 retries with exponential backoff · 30 s timeout · verbatim CSV cache
- Basketball-Reference panel: NBA API only gives **G / F / C** → classic 5 positions (**PG/SG/SF/PF/C**) come from Basketball-Reference → the page is **Cloudflare-protected**, so we **save it once in a browser** and parse it with a **stdlib-only HTML parser** (no extra dependencies) → cached to JSON

**Talk track:**

> Stage one is about being a polite guest. We make 39 requests: the full player list, all 30 rosters, per-player season totals, clutch-situation splits, starters-versus-bench minutes, and team totals. Every call is throttled to one every seven-tenths of a second, retried up to four times with exponential backoff, and saved verbatim — no processing, no transformation, so we never depend on the network twice.
>
> One source needs special handling. The NBA API only publishes three positions — guard, forward, center. Our simulator uses the classic five, so positions come from Basketball-Reference — but that page sits behind a Cloudflare challenge that blocks scripts. The solution is a one-time manual step: someone saves the page once in a browser, and our parser — written with Python's standard library only — extracts every player's classic position and caches it. After that, the pipeline never needs that page again.

---

## Slide 7 — Stage 2: raw numbers → attributes

**Time:** 3:50 → 4:40

**On the slide:**
- Left: the master table — one row per player, joining season totals + identity + roster position + classic position + starter/bench minutes + clutch + advanced stats (zero-minute players dropped)
- Right: the six derivation highlights:
  1. **Normalize everything** to 0–1
  2. **Shrinkage** — players with few attempts get 10 pseudo-attempts pulled toward the league average (so a player who went 3-of-6 doesn't look like a 50% shooter)
  3. **Possession math** — defensive stats are per-*defended possession*, estimated as FGAs + 0.44 × FTAs + turnovers
  4. **Usage & rebound** reuse the league's own USG% / OREB% columns
  5. **Stamina** — minutes-per-game model with an age penalty (0.5% per year over 34)
  6. **Clutch factor** — how a player's shooting improves in close, late-game minutes

**Talk track:**

> Stage two is where raw integers become attributes. It starts with a master table: one row per player, joining season totals, identity, roster position, the classic position from Basketball-Reference, and the starter-versus-bench minute split. Players with zero minutes never enter the pipeline.
>
> Then the derivations — and I'll highlight the ones with real judgment behind them. First, **shot percentages are shrunk toward the league average**: every player gets ten pseudo-attempts from league mean, so a player who went three-for-six doesn't look like a 50% three-point shooter. Second, **defensive stats are computed per defended possession**, because a turnover rate is meaningless unless you divide by the events the player actually defended. Third, **stamina and clutch are behavioral models**, not raw stats: stamina grows with minutes per game and decays with age, and clutch measures how much better a player shoots in the final minutes of a close game — exactly the situations our sim wants to dramatize. *[cut if over time:] Usage and offensive-rebounding rates are passed straight through from the league's own published USG% and OREB% columns.*

---

## Slide 8 — The contract gate & quality report

**Time:** 4:40 → 5:15

**On the slide:**
- The gate: `validate_processed_output()` runs **before any file is written** → out-of-range value, duplicate id, missing player, broken roster link → fails with **every** problem listed, exit code 1, **last-known-good files untouched**
- Enforcement point for the contract: the same Pydantic schemas are imported by the engine's own demo — the gate protects all consumers at once
- Two policy decisions that keep files consistent:
  - Zero-minute players are excluded (5 roster players dropped)
  - A player's team = the club they *played* for in the season (57 players waived mid-season stay with their season team)
- `data_quality.json`: counts, starters 216 / bench 366, small-sample flags, attribute min/mean/max

**Talk track:**

> The last step is our quality gate — this is the contract from slide 4 being *enforced*. Before a single file is written, the entire output is validated against the Pydantic schema: ranges in bounds, no duplicate IDs, every roster entry pointing at a real player. If anything fails, the pipeline lists every problem and exits, protecting the last-known-good files. A broken pipeline is better than a silently broken dataset.
>
> Two policy decisions make those referential-integrity checks pass *by construction*: we exclude zero-minute players, and we assign each player to the club they actually played for during the season — so all 582 roster entries and all 30 teams agree in both directions. Alongside the files we ship a machine-readable quality report, so at a glance we can see coverage, starter counts, and any attribute distributions that look off.

---

## Slide 9 — Running it · what comes next · closing

**Time:** 5:15 → 5:35

**On the slide:**
- Commands:
  ```bash
  python -m app.data_ingestion          # fetch (once) + derive
  python -m app.data_ingestion --no-fetch  # offline re-derive
  python -m app.data_ingestion --refresh   # force raw re-fetch
  ```
- Next hop: `players.json` / `teams.json` → **DB seed** → catalog API → engine `LiveTeam.from_team_and_players`
- Links: `docs/statistics.md` (every formula), `docs/data_ingestion.md` (every failure mode)

**Talk track:**

> In practice, the whole thing is three commands: fetch and derive, or derive offline from the cache, or force a full refresh. And the output doesn't sit idle — the seed script loads it into PostgreSQL for the API, and the engine builds live teams straight from these same files.
>
> To sum up: one-time fetching, offline derivation, real statistics, and a contract gate at the exit. Clean data in means simulations that behave like actual basketball — and that's what makes everything downstream work. Questions welcome.

---

## Appendix — backup slides for Q&A

*Not timed. Use if the audience asks about the guts.*

### A.1 — The possession math in one example
Per team, we estimate possessions per game as `Σ(FGA + 0.44·FTA + TOV) ÷ games` (the 0.44 factor is the standard NBA free-throw possession constant). Defensive attributes divide by the player's *defended* possessions — `team possessions × min(minutes/48, 1)` — so a bench player's steal rate isn't inflated by defense he wasn't on the floor for.

### A.2 — Shrinkage worked example
League-average two-point rate: ~0.48. A player with 200 attempts at 58% keeps a rate near 0.58. A player with 6 attempts at 100% is pulled to `(6 + 10 × 0.48) ÷ (6 + 10) ≈ 0.64` — defensible instead of mythical. `SHRINKAGE_K = 10` pseudo-attempts lives in `config.py`, so it's tunable without touching code.

### A.3 — The validation gate error output
The CLI prints every failing record at once, for example: `players.json: player 'x' two_pt_pct=1.42 out of range [0,1]` then exits 1 with a clear `[error] derive output failed schema validation, nothing was written`. No partial writes; you fix the source or the formula and rerun.

### A.4 — The contract in code
`engine/entities.py` imports `from app.data_ingestion.schemas import Player, PlayerAttributes, Team` — the engine and the ingestion output literally share the same classes. On the DB side, `Player.attributes` is a `JSON` column, so the file schema and the database agree without a migration; the seed script copies `entry["attributes"]` straight into it.

---

*End of script. Core talk ≈ 5:00 (cut the bracketed sentences on slides 4 and 7); full version ≈ 5:30.*