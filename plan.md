# Predictive Basketball Simulator — Detailed Implementation Plan

**Team Robô Cestinha:** Eliel Oliveira, Luiz Fernando Morato, Gabriel Tadeu Diniz, Luigi Mello Rigato, Matheus Rufino da Silva
**Course:** MC 857

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Component Breakdown & Internal Contracts](#2-component-breakdown--internal-contracts)
3. [Phase-by-Phase Implementation Plan](#3-phase-by-phase-implementation-plan)
4. [Parallelism & Dependency Map](#4-parallelism--dependency-map)
5. [Risk Management & Mitigations](#5-risk-management--mitigations)

---

## Status Overview

**Last updated:** 2026-09-21 — item-level status is marked `[x]` (done) / `[~]` (partial) / `[ ]` (not started) inside each phase below. The fine-grained backlog lives in [`docs/BACKLOG.md`](docs/BACKLOG.md) and the live architecture in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); keep those two in sync when updating this section.

> ⚠️ **Architecture pivot (2026-09-13):** the original plan specified a single-process Streamlit app. The team replaced it with a **React (Vite + TypeScript) frontend**, a **FastAPI backend**, and **PostgreSQL** persistence. Phase names below are kept for continuity — where a phase says "Streamlit", read "React frontend / FastAPI API". Sections 1.1–1.3 already reflect the current architecture.

| Phase | Title | Status | Notes |
|---|---|---|---|
| **A** | Data Contracts & Scaffolding | ✅ Done | Pydantic schemas + validators; `backend/` + `frontend/` monorepo |
| **B** | Data Acquisition & Cleaning | ✅ Done | `data/processed/players.json` (582 players) + `teams.json` (30 teams); see `docs/statistics.md` |
| **C** | State Machine Engine Core | 🟡 Partial | Possession loop, heuristics, clock, match log run headless (`engine/`); fouls/free-throws, substitutions, timeouts and unit tests pending |
| **D** | Full Application (React + FastAPI) | 🟡 Partial | Home + Match Broadcast pages exist (mock-powered); Team Locker, Bracket, Tournament, real match endpoints missing |
| **E** | 2D Court Visualization | 🟡 Partial | Live court/broadcast animation done in React (mock frames); persisted-frames replay pending |
| **F** | LLM Narration | ⛔ Not started | Commentary column is mock/static text only |
| **G** | Tournament Bracket | 🟡 Partial | Backend bracket seeding done (linked `Match` rows); UI, simulation advancement, bracket display pending |
| **H** | Final Polish & Testing | ⛔ Not started | No test suite yet; frontend is mock-backed |

**Legend:** ✅ done · 🟡 in progress / partially done · ⛔ not started.

---

## 1. Project Overview & Architecture

### 1.1 What We Are Building

A statistical basketball match simulator that runs **single-elimination multiplayer tournaments**. A React (Vite + TypeScript) frontend talks to a FastAPI backend over REST (commands/queries) and Server-Sent Events (live match frames), and PostgreSQL persists the team/player catalog plus all session & match data (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)). The simulation uses:

- A **deterministic state machine** to model possession flow (who has the ball, what action is taken, what the outcome is).
- **Heuristic outcome resolution** — every possession action (shot, pass, dribble, turnover, foul) resolves through probabilities computed from real player attributes and game context. No trained model: the statistics themselves drive the outcomes.
- An **LLM** to generate dramatic play-by-play commentary from structured match events (live commentary column; post-game recap planned).
- A **2D court visualization** rendering live player/ball movement from dense frame chunks, with replay from stored frames planned.

### 1.2 High-Level Data Flow

```
NBA APIs / Basketball-Reference
        │  (offline, one-off job)
        ▼
  ┌───────────────────────────────────┐
  │ Data Scraper & Cleaner            │──────► players.json / teams.json
  │ (backend/src/app/data_ingestion)  │        (data/processed/) ──► db seed
  └───────────────────────────────────┘
        │  (seeds PostgreSQL catalog)
        ▼
  ┌─────────────────────────────────────────────┐
  │              FastAPI Backend                │
  │  ┌───────────────────────────────────────┐  │
  │  │ Simulation Engine (engine/)           │  │
  │  │  State machine (possession loop)      │  │
  │  │  + heuristic outcome resolution       │  │
  │  └───────────────────────────────────────┘  │
  │  ┌───────────────┐   ┌──────────────────┐  │
  │  │ Domain Svc:    │   │ PostgreSQL:      │  │
  │  │ sessions,      │   │ catalog +        │  │
  │  │ bracket        │   │ session/match    │  │
  │  └───────────────┘   └──────────────────┘  │
  └─────────────────┬───────────────────────────┘
                    │  REST (commands/queries) + SSE (live frames/events)
                    ▼
  ┌──────────────────────────────────────────┐
  │          React Frontend (frontend/)      │
  │  Home · Match Broadcast: live court,     │
  │  scoreboard, play-by-play, commentary    │
  └──────────────────────────────────────────┘
```

### 1.3 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI & Dashboards | React 19 + Vite + TypeScript + Framer Motion | Home, Team Locker, Bracket, Match Broadcast |
| 2D Visualization | React + SVG (custom `CourtStage`) | Live/replay court rendering with pass/shot trajectories |
| Backend API | FastAPI (Python 3.11+) | Sessions, catalog, bracket, match endpoints (REST + SSE) |
| Backend Engine | Python (`backend/src/app/engine/`) | State machine, possession loop, heuristic outcome resolution, fatigue/foul system |
| Persistence | PostgreSQL + SQLAlchemy 2 + Alembic | Global catalog + all session/match data (runtime source of truth) |
| Data Source | `nba_api` Python package, Basketball-Reference (positions + fallback) | Player profiles, team rosters, season stats |
| LLM Narration | OpenAI API / Groq (Llama 3) | Live commentary + post-game recap |
| Data Exchange | JSON files (players, teams, match logs) + Pydantic schemas | Contract between components; the DB is the runtime contract |

---

## 2. Component Breakdown & Internal Contracts

### 2.1 Shared Data Schemas (Defined First — Blocking for All Modules)

These JSON schemas are the **contract** between components. They must be finalized before any module that consumes or produces them can be integrated.

#### `players.json` — Player Profiles

```jsonc
{
  "player_id": "lebron_james",
  "name": "LeBron James",
  "team_id": "lal",
  "position": "SF",
  "attributes": {
    "two_pt_pct":      0.58,   // career or season 2pt%
    "three_pt_pct":    0.35,
    "ft_pct":          0.74,
    "turnover_rate":   0.12,   // turnovers per possession
    "foul_rate":       0.06,   // fouls committed per defensive possession
    "rebound_rate":    0.11,   // rebounds per available rebound
    "assist_rate":     0.22,   // assists per teammate basket
    "steal_rate":      0.02,
    "block_rate":      0.03,
    "stamina":         0.85,   // 0-1, decays during game
    "clutch_factor":   0.90,   // 0-1, boosts performance in close late-game
    "usage_rate":      0.32    // fraction of team possessions used
  }
}
```

#### `teams.json` — Team Rosters

```jsonc
{
  "team_id": "lal",
  "name": "Los Angeles Lakers",
  "roster": ["lebron_james", "anthony_davis", "..."],
  "team_stats": {
    "pace": 100.5,
    "off_rtg": 114.2,
    "def_rtg": 112.8
  }
}
```

#### `match_log.json` — Structured Match Log (Produced by Engine, Consumed by UI + LLM)

```jsonc
{
  "match_id": "lal_vs_bos_001",
  "home_team": "lal",
  "away_team": "bos",
  "quarters": [
    {
      "quarter": 1,
      "possessions": [
        {
          "possession_id": 1,
          "team": "lal",
          "actions": [
            {"type": "dribble",  "player": "lebron_james", "duration_s": 4.2},
            {"type": "pass",     "from": "lebron_james", "to": "anthony_davis", "success": true},
            {"type": "shot_2pt", "player": "anthony_davis", "result": "made"}
          ],
          "outcome": "2pt_made",
          "points": 2
        }
        // ... more possessions
      ],
      "score_home": 28,
      "score_away": 24
    }
    // ... more quarters
  ],
  "box_score": {
    "lal": { "player_stats": { "lebron_james": {"pts": 27, "reb": 7, "ast": 8, /*...*/ } } },
    "bos": { /*...*/ }
  },
  "key_moments": [
    {"quarter": 4, "time_remaining_s": 12, "description": "LeBron hits go-ahead 3-pointer", "score": "102-100"}
  ]
}
```

### 2.2 Spatial State Machine & Court Model (Engine Core)

#### 2.2.1 Discretized Court: 50-Cell Grid ($10 \times 5$)
The basketball court is discretized into 50 rectangular cells ($10 \times 5$, ratio 2:1 matching the official 94×50 ft NBA court). There is **no out-of-bounds**; movements are clamped strictly within $[0, 9] \times [0, 4]$:

```
    Y (Width: 0..4)
    ▲
  4 │ [0,4] [1,4] [2,4] [3,4] [4,4] │ [5,4] [6,4] [7,4] [8,4] [9,4]
  3 │ [0,3] [1,3] [2,3] [3,3] [4,3] │ [5,3] [6,3] [7,3] [8,3] [9,3]
RimA│ (O)   [1,2] [2,2] [3,2] [4,2] │ [5,2] [6,2] [7,2] [8,2]   (O) Rim B
  1 │ [0,1] [1,1] [2,1] [3,1] [4,1] │ [5,1] [6,1] [7,1] [8,1] [9,1]
  0 │ [0,0] [1,0] [2,0] [3,0] [4,0] │ [5,0] [6,0] [7,0] [8,0] [9,0]
    └───────────────────────────────┴───────────────────────────────► X (Length: 0..9)
       0     1     2     3     4        5     6     7     8     9
               Team A Half                    Team B Half
```
- **Rims / Baskets:**
  - Team A defends Rim A at `(0, 2)` and attacks Rim B at `(9, 2)`.
  - Team B defends Rim B at `(9, 2)` and attacks Rim A at `(0, 2)`.
- **3-Point Line Boundary:** Determined dynamically by Euclidean distance to target rim:
  - Euclidean distance $\ge 3.0$ cells $\to$ 3-pointer.
  - Euclidean distance $< 3.0$ cells $\to$ 2-pointer (inside the arc / paint).
- **Match Start Positions:** At tip-off, all 10 on-court players start clustered near mid-court (columns 4 and 5).

#### 2.2.2 State Graph Topography

```
                       [ Tip-off / Ball Dispute ]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼ (p_A)                       ▼ (p_B)
             [ POSSESSION: TEAM A ]        [ POSSESSION: TEAM B ]
            (A attacks, B defends)        (B attacks, A defends)
                    │                               │
                    └───────────────┬───────────────┘
                                    │ (Active Handler)
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                < PASS >         < MOVE >        < SHOOT >
                /   |   \           │               │
       Teammates 1, 2, 3, 4         │               ├─► [ Made ] (2pt or 3pt)
               │                    │               │    Score updated
               ├─► [ Completed ]    │               │    Possession flips
               │    New handler     │               │
               │    Clock advances  │               └─► [ Missed ]
               │    Possession kept │                     │
               │                    │                     ▼
               └─► [ Intercepted ]  │            < Rebound Dispute >
                    Steal by def.   │            (All 10 players contest)
                    Possession flips│               /                  \
                                    │         (Offensive)          (Defensive)
                                    │              ▼                    ▼
                                    │       Possession kept      Possession flips
                                    │       Reset shot clock 14s
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
   [ 8 Directions: N, NE, E, SE, S, SW, W, NW ]          [ Idle / Parado ]
           │                                                 │
           ├─► [ Moves Successfully ]                        ├─► [ Holds Ball ]
           │    Update (x, y) clamped                        │    Clock ticks 2-4s
           │    Possession kept                              │    Possession kept
           │                                                 │
           └─► [ Stripped / Turnover ]                       ├─► [ Defensive Foul ]
                Turnover committed                           │    Personal foul added
                Possession flips                             │    Reset clock / Free throws
                                                             │
                                                             └─► [ Stripped / Turnover ]
                                                                  Possession flips
```

#### 2.2.3 Two-Phase Evolution Strategy
- **Phase 1 (MVP Scaffolding & Graph Integrity):**
  - Other 9 players remain static on court while ball handler moves.
  - Transition probabilities across graph edges use uniform or simple attribute-weighted baselines to verify that 48-minute games run without deadlock, clock rules trigger properly, and `match_log.json` schemas are valid.
- **Phase 2 (Spatial Dynamics & Advanced Heuristics):**
  - **Offensive Spacing:** Teammates dynamically reposition each step to maximize the convex hull area / geometric distance between them.
  - **Man-to-Man Defense:** Each defender tracks an assigned matchup, maintaining tight positioning between their matchup and the rim.
  - **Trajectory-Based Interceptions:** Passes trace a line segment between passer and receiver. The distance of each defender to that line segment determines interception probability, scaled by defender `steal_rate` vs passer `turnover_rate`.
  - **Contested Shooting:** Nearest defender distance acts as a defensive modifier on shooter's base `two_pt_pct` / `three_pt_pct`.
  - **Position-Weighted Rebounding:** Player distance to the rim exponentially weights their base `rebound_rate`.

---

## 3. Phase-by-Phase Implementation Plan

Each phase lists its goal, deliverables, and dependencies (which phases it builds on and which it can be done alongside).

---

### Phase A: Data Contracts & Project Scaffolding

**Priority:** HIGH — Must be done first, unblocks everything else.
**Can be parallel with:** Nothing (first phase).

#### A.1 Project Repository Setup — ✅ DONE
- [x] Python project managed with **uv** (`pyproject.toml` + `uv.lock`, Python 3.11+ pinned in `.python-version`).
- [x] Folder structure (evolved from the original sketch into a backend/frontend monorepo):
  ```
  robo-cestinha/
  ├── backend/src/app/   # FastAPI: api/, domain/ (sessions, bracket), engine/, data_ingestion/, db/ (models + Alembic)
  ├── frontend/src/      # React: pages/ (Home, MatchBroadcast), components/, hooks/, lib/i18n/, mock/
  ├── data/              # raw cache (gitignored) + processed JSON (players/teams)
  ├── docs/              # ARCHITECTURE.md, statistics.md, data_ingestion.md, BACKLOG.md
  └── .spec/             # product specs & solution design
  ```
- [x] `.gitignore`, `README.md`, `Makefile` (bootstrap/dev/migrate/reset-db/format), shared venv via `uv sync`.

#### A.2 Formalize JSON Schemas — ✅ DONE
- [x] Lock down `players.json`, `teams.json`, `match_log.json` schemas (Section 2.1).
- [x] Validators via Pydantic — single source of truth: `backend/src/app/data_ingestion/schemas.py` (catalog) and `backend/src/app/engine/schemas.py` (match log / box scores).
- [x] SQLAlchemy models + Alembic migration `0001_initial_tables.py` implement the runtime-side contract.

**Deliverable:** ✅ DONE — schema package in `backend/src/app/` imported by engine, data ingestion, and domain services.

---

### Phase B: Data Acquisition & Cleaning

**Priority:** HIGH — Provides the real-world data the engine needs.
**Depends on:** Phase A (schemas).
**Can be parallel with:** Phase C (engine core, if engine uses mock data initially).

#### B.1 NBA API Integration — ✅ DONE
- [x] **Implemented — see [`docs/statistics.md`](docs/statistics.md) and `backend/src/app/data_ingestion/`.**
- [x] Uses the `nba_api` Python package (stats.nba.com) for the **2025-26 regular season**, cached verbatim under `data/raw/2025_26/`.
- [x] Extracts per-player: FG%, 3P%, FT%, rebounds, assists, turnovers, steals, blocks, usage rate (+ clutch and OREB%).
- [x] Extracts per-team: pace, offensive rating, defensive rating.

#### B.2 Basketball-Reference Scraper — ✅ DONE
- [x] Classic 5-position taxonomy (PG/SG/SF/PF/C) pulled from a locally-saved Basketball-Reference totals page (`bballref.py`, stdlib HTML parsing).
- [x] Pipeline refuses to derive output without it (see `docs/statistics.md §7`); matches the positions onto players.

#### B.3 Data Cleaning & Normalization — ✅ DONE
- [x] Raw stats converted into the 0–1 or percentage-based attributes defined in `players.json` (shrinkage applied to stabilize rates).
- [x] `stamina` derived from minutes played; `clutch_factor` from clutch-situation splits; turnover/steal/rebound rates from league endpoints.
- [x] Outputs `data/processed/players.json` (582), `teams.json` (30), `attributes_table.csv`, `data_quality.json`.

#### B.4 Team Builder (UI and Logic) — 🟡 PARTIAL (UI pending)
- [ ] Allow users to select NBA teams or create custom teams with custom player attributes (the "Team Locker" screen in `.spec/` replaces the old Streamlit idea).
- [x] UI scaffolding exists: React design system (Button, Card, Modal, Chip, SegmentedControl, …) + Home page, i18n (en-US/pt-BR).

**Deliverable:** 🟡 `data/processed/players.json` + `teams.json` **DONE** (582 players / 30 teams, seeded into Postgres via `backend/src/app/db/seed.py`); **Team Locker page not built yet** (BACKLOG `TS-01…TS-03`).

---

### Phase C: State Machine Engine Core

**Priority:** HIGH — The heart of the simulation.
**Depends on:** Phase A (schemas).
**Can be parallel with:** Phase B (use mock player data during development).

#### C.1 Possession Loop (Heuristics) — ✅ DONE
- [x] State machine implemented in `engine/state_machine.py` + `engine/heuristics.py` (`decide_handler_action`, `resolve_pass_teammate`/`resolve_pass_outcome`, `decide_move_direction`, `resolve_move_outcome`, `resolve_shot`, `resolve_rebound`).
- [x] Every action resolved via **weighted random choice** from real player attributes (shot %, turnover, steal, rebound, usage, clutch, fatigue) — no model involved.
- [x] 50-cell court grid, 8-direction movement, 2pt/3pt distance rule in `engine/grid.py`; players start clustered mid-court.

#### C.2 Fatigue & Foul System — 🟡 PARTIAL
- [x] **Fatigue:** `current_stamina` decays per second on court (`LivePlayer.record_minutes`); below 0.4 stamina, shooting penalized in `resolve_shot`.
- [~] **Fouls:** foul events can be drawn on idle moves (weighted by `foul_rate`), tracked per player/quarter — but **free throws, 5-foul fouling-out, and substitutions are not yet implemented**.

#### C.3 Clock & Quarter Management — 🟡 PARTIAL
- [x] 4 quarters × 12 min, 24 s shot clock (14 s after offensive rebound), 5-min OT period, quarter-end handling (`engine/clock.py` + `match_runner.py`).
- [ ] Timeouts (7 per team per game) and fatigue-triggered substitutions not implemented.

#### C.4 Match Log Generation — ✅ DONE
- [x] Every possession/action writes to the in-memory `MatchLog` (Pydantic `engine/schemas.py`), incl. box scores + key moments; `engine/demo.py` runs a full headless match.
- [ ] Not yet persisted per match in the DB, and not yet emitted as `MatchEvent` / `MatchFrameChunk` for SSE streaming (only designed in `.spec/solution-design.md`).

#### C.5 Unit Tests — ⛔ NOT STARTED
- [ ] No test suite yet (`backend/tests/` absent; `pytest`/`pytest-asyncio` are dev extras but unused). Needed: extreme attributes (100% shooter never misses), fatigue decay, foul accumulation, quarter transitions.

**Deliverable:** 🟡 Headless engine **exists** (takes two `LiveTeam`s → full `MatchLog`). Wiring engine output into a Match service/API + live streaming events is the main remaining engine work (BACKLOG `SE-*`, `LB-02/03`).

---

### Phase D: Full Application — React Frontend + FastAPI (supersedes the original Streamlit phase)

**Priority:** MEDIUM.
**Depends on:** Phase A (schemas), Phase B (team data), Phase C (engine for full integration).
**Can be parallel with:** Phases C (scaffolding and mock-based pages), E, F, G.
**Note (2026-09-13):** the Streamlit app was replaced by a **React + Vite frontend** and a **FastAPI backend** — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The page table below maps to the current codebase.

#### D.1 Page Structure (React Routes)

| Page | Route | Status | Purpose | Depends On |
|---|---|---|---|---|
| Home | `/` | ✅ done (mock) | Display name (localStorage), join UI, recent sessions | Nothing |
| Team Locker (was "Team Setup") | `/setup` | ⛔ not started | Browse catalog, claim a team, view roster/stats | Phase B + API |
| Bracket Editor | `/bracket` | ⛔ not started | Interactive single-elimination bracket builder | Phase A + G |
| Simulation Runner | `/simulate` | ⛔ not started | Start simulation, progress, live scoreboard via SSE | Phase C |
| Match Broadcast (was "Match Result") | `/match-demo` (demo) · `/match/<id>` (real) | 🟡 page built, **mock data** | Box score, play-by-play, 2D playback | Phase C + E |
| Tournament | `/tournament` | ⛔ not started | Full bracket view with results, advance winners | Phase C + G |

#### D.2 Session & UI State Management
- [x] Backend: `POST /sessions` creates a Session + owner User + seeds the bracket (BACKLOG `SI-01`).
- [~] Frontend: display name persisted to localStorage (Home page); session join flow not wired to the real API yet (`SI-02…SI-05`).
- [ ] Bracket/team/match state in React + serializable API mirror — not started.

#### D.3 Simulation Progress & Live Updates
- [x] Backend runs the engine **headless and fast** (full match in a few seconds — `engine/match_runner.py`).
- [ ] Live delivery via **SSE** (`MatchEvent` + `MatchFrameChunk`) designed in `.spec/solution-design.md` but **not implemented** — no `/matches` endpoints yet (BACKLOG `LB-02/03`).

#### D.4 Box Score & Stats Display
- [x] `MatchLog` produces full box scores (`engine/schemas.py` → `TeamBoxScore`/`PlayerBoxScore`).
- [ ] No box-score/stats view yet — broadcast components render from `mockMatchData.ts`.

**Deliverable:** 🟡 Navigable app: **Home + Match Broadcast (demo/mock) working**; Team Locker, Bracket, Tournament, and real API-backed match pages still to build (BACKLOG `TS-*`, `TB-*`, `MR-*`).

---

### Phase E: 2D Court Visualization

**Priority:** LOW-MEDIUM — Polish feature.
**Depends on:** Phase C (final `match_log.json` structure).
**Can be parallel with:** Phases D, F, G.

#### E.1 Court Rendering — ✅ DONE (React/SVG)
- [x] SVG court (94×50 ft; config in `frontend/src/config/court.ts`), players as labeled dots with team colors, ball with offset physics (`CourtStage/`).

#### E.2 Live Playback & Key Moments — 🟡 PARTIAL
- [x] Frame-queue player with speed control (1×/1.5×/2×) and pause (`hooks/useGameFrames.ts`), Framer Motion animations, pass/release trajectory lines — currently driven by the **mock engine** (`frontend/src/mock/mockEngine.ts`).
- [ ] Key-moment slideshow (2–3 frame steps per key moment from `match_log.json`) not implemented.

#### E.3 Integration into Match Broadcast Page — 🟡 PARTIAL
- [x] Court embedded in the broadcast page with a Timeline Scrubber (`TimelineScrubber.tsx`).
- [ ] Replay page from stored `MatchFrameChunk`s (BACKLOG `MR-01`/`MR-02`) not built.

**Deliverable:** 🟡 Animated live court works end-to-end on mock data; real-frames playback requires the engine streaming layer + persistence.

---

### Phase F: LLM Sports Narration

**Priority:** LOW — Cool factor, not core functionality.
**Depends on:** Phase C (final `match_log.json` structure).
**Can be parallel with:** Phases D, E, G.

#### F.1 Prompt Engineering — ⛔ NOT STARTED
- [ ] Design a system prompt for the LLM:
  ```
  You are a dramatic basketball play-by-play announcer. Given a JSON match log,
  produce an exciting 3-paragraph game recap covering: opening highlights, key
  turning points, and closing moments. Use Brazilian Portuguese (or English),
  energetic tone, and reference player names and stats from the log.
  ```
- [ ] Experiment with different prompt variants for tone, length, and language.

#### F.2 Log/Event-to-Prompt Compiler — ⛔ NOT STARTED
- [ ] Extract from `match_log.json` / `MatchEvent`s: final score, top 3 performers (PTS/REB/AST), key moments, quarter-by-quarter progression.
- [ ] Format as a compact text blob appended to the system prompt.

#### F.3 LLM API Integration — ⛔ NOT STARTED
- [ ] Provider support: OpenAI (GPT-4o-mini for cost) or Groq (Llama 3, free tier); configurable API key.
- [ ] Plan evolved: commentary feeds on **live `MatchEvent` groups** via a Commentary Generator (BACKLOG `LB-04`), plus a post-game recap — run in a background task so the UI never blocks.

#### F.4 Fallback & Error Handling — ⛔ NOT STARTED
- [ ] Static template-based recap when the API fails (timeout, rate limit, no key).
- [ ] Never block the page from loading because the LLM is slow.

**Deliverable:** ⛔ Not started — `CommentaryColumn.tsx` renders mock/static text. Blocked on the engine streaming layer (LB-02/03) and the prompt/API pipeline.

---

### Phase G: Tournament Bracket Logic

**Priority:** MEDIUM.
**Depends on:** Phase A (schemas), Phase C (engine for match simulation).
**Can be parallel with:** Phases D, E, F.

#### G.1 Bracket Data Structure — ✅ DONE (backend)
- [x] 4/8/16-team single-elimination brackets (2ⁿ sizes) as **linked `Match` rows** (`next_match_id` + `next_match_slot`) — `backend/src/app/domain/bracket/`.
- [x] `BracketService.seed_bracket_for_session` seeds any catalog team count (round 1 "ready", later rounds "locked").
- [ ] Byes for non-power-of-2 sizes not supported (out of current scope).
- [x] JSON schema for bracket state (still the UI contract):
  ```jsonc
  {
    "rounds": [
      {
        "round_number": 1,
        "matches": [
          {"match_id": "r1m1", "team_a": "lal", "team_b": "bos", "winner": null}
        ]
      }
    ]
  }
  ```

#### G.2 Bracket Editor UI — ⛔ NOT STARTED
- [ ] Dropdown/selectbox-based team assignment to bracket slots (no drag-and-drop; selectboxes in a visual bracket layout).

#### G.3 Tournament Simulation — 🟡 PARTIAL (backend seeding only)
- [x] Round structure and advancement links created server-side at session creation (`POST /sessions`).
- [ ] "Simulate All": running `MatchRunner` per match, persisting results, advancing winners — **not wired**; needs the Match API/engine service (BACKLOG `LB-02`, `TB-*`).

#### G.4 Bracket Display — ⛔ NOT STARTED
- [ ] Visual bracket tree with winner advancement + champion highlight.

**Deliverable:** 🟡 Backend seeding done; build-bracket UI, tournament simulation, and bracket display pending.

---

### Phase H: Final Polish & Testing

**Priority:** MEDIUM — Quality assurance.
**Depends on:** Everything above.
**Can be parallel with:** Nothing (final phase).

#### H.1 End-to-End Integration Testing — ⛔ NOT STARTED
- [ ] Full flow: open app → pick teams → build bracket → simulate → view broadcast/replay + narration.
- [ ] Edge cases: all players foul out, overtime, blowouts, custom players.

#### H.2 Performance Profiling — 🟡 PARTIAL
- [x] Headless match sim completes in a few seconds (`engine/match_runner.py`) — tune during H.
- [ ] LLM/SSE must never block the UI; memory checks for 16-team brackets (15 matches) not measured.

#### H.3 UI/UX Polish — 🟡 PARTIAL
- [x] Design system with shared tokens/components (`frontend/src/styles/tokens.css`, per-component `.module.css`) — replaces the old Streamlit theme idea.
- [ ] Error/empty states and loading spinners for real API calls (mock data never hits the network).

#### H.4 Documentation — ✅ DONE (mostly)
- [x] `README.md` (uv setup + data ingestion), `docs/ARCHITECTURE.md`, `docs/statistics.md`, `docs/data_ingestion.md`, `docs/BACKLOG.md`, `backend/openapi.yaml`.
- [x] Docstrings on key engine/services functions (ruff-formatted).
- [ ] End-to-end "how to run the app" (backend + frontend dev flows) and demo screenshots/video pending.

**Deliverable:** ⛔ Not production-ready yet — backend services lack tests, the frontend is mock-backed, and the API surface is incomplete.

---

## 4. Parallelism & Dependency Map

```
Phase A: Contracts & Scaffolding
   │
   ├──► Phase B: Data Acquisition        (parallel with C)
   │
   └──► Phase C: Engine Core             (heuristics; after A, parallel with B)
             │
             ▼
   ┌─────────┼─────────┬───────────┐
   ▼         ▼         ▼           ▼
Phase D:  Phase E:   Phase F:    Phase G:
 React      2D Court   LLM          Tournament
 UI         Renderer   Narration
   └─────────┴─────────┴───────────┘
             │
             ▼
  Phase H: Final Polish & Testing
```

### Summary of What Can Happen in Parallel

| Parallel Group | Phases |
|---|---|
| **Group 1** (after A) | B (Data) + C (Engine) |
| **Group 2** (after C) | D (UI), E (2D), F (LLM), G (Tournament) |
| **Group 3** (final) | H (Polish) |

### Sequential Gates (Must Happen in Order)

1. **A** must finish first (schemas are the contract).
2. **D–G** can start once **C** provides a stable `match_log` contract (D can scaffold earlier with mock data).
3. **H** cannot start until all other phases are complete.

---

## 5. Risk Management & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| `nba_api` package is deprecated or rate-limited | HIGH — No real player data | Medium | Basketball-Reference as fallback (Phase B.2). Cache all API responses locally. |
| Heuristic outcomes drift from realistic NBA distributions | MEDIUM — Sims feel off | Medium | Calibrate the attribute→probability curves against real league averages during Phase H; every formula is isolated in data ingestion and the engine, so tuning is cheap. |
| Long-running simulation blocks the live UI | HIGH — App freezes | Medium | Engine runs headless and fast (<3 s/match); live streams arrive via **SSE** (`MatchEvent`/`MatchFrameChunk`) so the React UI never blocks. Replays read stored chunks. |
| LLM API is slow or unavailable | LOW — Narration is non-critical | Medium | Implement static template fallback (Phase F.4). Narration is a "nice to have," not core. |
| Team member availability gaps | MEDIUM — Work blocked | Medium | Phases are designed with clear interfaces. One person's module can progress using mock data that conforms to the schema contract from Phase A. |
| Scope creep (too many features) | HIGH — Won't finish on time | Medium | The plan is split into MUST (A–C, D basic), SHOULD (D full, G), and NICE (F). If time is tight, drop LLM narration (F) first — its UI slot should render a static fallback. |

---

*This plan is a living document. Update it as phases are completed, dependencies shift, or scope changes are decided by the team.*