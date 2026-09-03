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
6. [Suggested Timeline](#6-suggested-timeline)

---

## 1. Project Overview & Architecture

### 1.1 What We Are Building

A statistical basketball match simulator that runs **single-elimination tournaments** entirely in-browser via Streamlit. The simulation uses:

- A **deterministic state machine** to model possession flow (who has the ball, what action is taken, what the outcome is).
- An **XGBoost classifier** to predict possession outcomes (2pt basket, 3pt basket, miss, turnover, foul) based on real NBA player stats.
- An **LLM** (post-game only) to generate dramatic sports narration from structured match logs.
- A **2D court visualization** showing interpolated player/ball movement, rendered after the simulation completes.

### 1.2 High-Level Data Flow

```
NBA APIs / Basketball-Reference
        │
        ▼
  ┌─────────────┐
  │ Data Scraper │──────► players.json  (cleaned player profiles)
  │ & Cleaner    │──────► teams.json    (team rosters & stats)
  └─────────────┘
        │
        ├──────────────────────┐
        ▼                      ▼
  ┌──────────────┐   ┌────────────────┐
  │ ML Trainer   │   │ State Engine   │
  │ (XGBoost)    │   │ (possession    │
  │              │   │  loop)         │
  └──────┬───────┘   └───────┬────────┘
         │                   │
         ▼                   ▼
  ┌──────────────────────────────────┐
  │        Simulation Runner         │
  │  State Machine + ML Predictor    │
  │           interleaved            │
  └──────────────┬───────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│ Stream-│ │ 2D Court │ │ Match    │
│ lit UI │ │ Renderer │ │ Log JSON │──► LLM Narration
└────────┘ └──────────┘ └──────────┘
```

### 1.3 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI & Dashboards | Streamlit | Tournament setup, live scoreboard, box scores, settings |
| 2D Visualization | Streamlit + Matplotlib / Plotly | Simplified court rendering (dot-level animation) |
| Backend Engine | Python 3.10+ | State machine, possession loop, fatigue/foul system |
| Data Source | `nba_api` Python package, Basketball-Reference scraping (fallback) | Player profiles, team rosters, historical stats |
| ML Model | XGBoost (classification) | Predict possession outcome from match state |
| LLM Narration | OpenAI API / Groq (Llama 3) | Post-game dramatic narration |
| Data Exchange | JSON files (players, teams, match logs) | Contract between all components |

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

### 2.2 State Machine Definition (Engine Core)

```
States:            Transitions:
┌──────────┐       ┌──────────┐       ┌──────────┐
│ POSSESS  │──────►│ TEAMMATE │──────►│ OPPONENT │
│ (ball    │ pass  │ (receives│ shot  │ (defense │
│  handler)│       │  ball)   │       │  reacts) │
└──────────┘       └──────────┘       └──────────┘
     ▲                                       │
     │         turnover / miss               │
     └───────────────────────────────────────┘

Sub-states within POSSESS:
  DRIBBLE ──► PASS ──► (teammate state)
           ──► SHOOT ──► (shot resolution ──► made/miss ──► opponent state)
           ──► TURNOVER ──► opponent state
```

---

## 3. Phase-by-Phase Implementation Plan

Each phase lists deliverables, who it depends on, and whether it can be done in parallel with other phases.

---

### Phase A: Data Contracts & Project Scaffolding

**Priority:** HIGH — Must be done first, unblocks everything else.
**Can be parallel with:** Nothing (first phase).
**Team allocation:** 1–2 people.

#### A.1 Project Repository Setup
- Initialize Python project with `pyproject.toml` or `requirements.txt`.
- Create folder structure:
  ```
  robo-cestinha/
  ├── data/              # raw & processed JSON files
  ├── engine/            # state machine, simulation runner
  ├── ml/                # training scripts, saved models
  ├── ui/                # Streamlit pages & components
  ├── narration/         # LLM prompt templates & API calls
  ├── visualization/     # 2D court renderer
  ├── tests/             # unit & integration tests
  └── config/            # YAML/JSON config files
  ```
- Set up `.gitignore`, `README.md`, and a shared virtual environment.

#### A.2 Formalize JSON Schemas
- Lock down `players.json`, `teams.json`, `match_log.json` schemas (as described in Section 2.1).
- Write validators using Pydantic or dataclasses — these become the **single source of truth** for every other module.
- Commit the schema definitions + validators. This is the contract.

**Deliverable:** A Python package with schema classes that all other modules import.

---

### Phase B: Data Acquisition & Cleaning  [PARALLEL with Phase C skeleton]

**Priority:** HIGH — Provides the real-world data the ML and engine need.
**Depends on:** Phase A (schemas).
**Can be parallel with:** Phase C (engine core, if engine uses mock data initially).
**Team allocation:** 1–2 people.

#### B.1 NBA API Integration
- Use the `nba_api` Python package to pull current season or historical player stats.
- Extract per-player: FG%, 3P%, FT%, rebounds, assists, turnovers, steals, blocks, usage rate.
- Extract per-team: pace, offensive rating, defensive rating.

#### B.2 Basketball-Reference Fallback Scraper
- Implement as a resilient fallback if `nba_api` is down or lacks data.
- Use `requests` + `BeautifulSoup` to scrape player pages.
- Match the same attribute fields as the API path.

#### B.3 Data Cleaning & Normalization
- Convert all raw stats into the 0–1 or percentage-based attributes defined in `players.json`.
- Derive `stamina` (default 0.85, scaled by minutes per game), `clutch_factor` (from 4th quarter stats vs overall), and `turnover_rate`.
- Output cleaned `players.json` and `teams.json` to `data/processed/`.

#### B.4 Team Builder (UI and Logic)
- Allow users to select NBA teams or create custom teams with custom player attributes in Streamlit.
- This is the first Streamlit page built — it doubles as the UI scaffolding.

**Deliverable:** `data/processed/players.json` + `data/processed/teams.json` with ≥30 NBA players, and a working Team Selection page in Streamlit.

---

### Phase C: State Machine Engine Core  [PARALLEL start with Phase B]

**Priority:** HIGH — The heart of the simulation.
**Depends on:** Phase A (schemas).
**Can be parallel with:** Phase B (use mock player data during development).
**Team allocation:** 2 people.

#### C.1 Possession Loop (No ML, Pure Heuristics)
- Implement the 3-state machine: `POSSESS → TEAMMATE → OPPONENT`.
- Each state triggers deterministic logic based on player attributes:
  - **Dribble:** consume N seconds, advance "ball position."
  - **Pass:** compute success probability from passer `turnover_rate` vs defender `steal_rate`.
  - **Shoot:** compute outcome from shooter %, defense adjusted.
  - **Turnover / Rebound:** transition to opponent.
- Initially use **weighted random choice** based on player attributes (no ML yet).

#### C.2 Fatigue & Foul System
- **Fatigue:** start at `stamina`, decay by 0.01 per possession for on-court players. At thresholds (e.g., 0.4), reduce shooting % and increase turnover rate. Substitutions triggered at fatigue thresholds or time intervals.
- **Fouls:** each defensive action has a small chance to commit a foul (based on player `foul_rate`). At 5 personal fouls → player fouls out. Team fouls → bonus free throws.

#### C.3 Clock & Quarter Management
- 4 quarters of 12 minutes each (NBA rules, adjustable via config).
- Shot clock (24s) enforcement.
- Timeouts (7 per team per game), substitutions, overtime logic.

#### C.4 Match Log Generation
- Every possession writes an entry to the in-memory `match_log` structure (conforming to Phase A schema).
- After the game ends, dump to `match_log.json`.

#### C.5 Unit Tests
- Test the state machine with extreme attribute values (e.g., 100% shooter should never miss).
- Test fatigue decay, foul accumulation, quarter transitions.

**Deliverable:** A headless Python module that takes two team IDs and produces a complete `match_log.json` using heuristic-based simulation.

---

### Phase D: ML Model Training  [PARALLEL with Phase C]

**Priority:** MEDIUM-HIGH — Replaces heuristics with data-driven predictions.
**Depends on:** Phase B (cleaned player data).
**Can be parallel with:** Phase C (engine core — engine uses heuristics until Phase E).
**Team allocation:** 1–2 people.

#### D.1 Feature Engineering
- Build a training dataset of NBA possessions (from play-by-play data via `nba_api` or Basketball-Reference).
- Features per possession:
  - **Offensive player attributes:** 2pt%, 3pt%, usage_rate, clutch_factor, current fatigue.
  - **Defensive matchup:** opponent steal_rate, block_rate, def_rtg.
  - **Game context:** quarter, time remaining, score differential, possession number.
  - **Team context:** home/away, pace.
- Label: possession outcome (multiclass):
  - `2pt_made`, `2pt_miss`, `3pt_made`, `3pt_miss`, `turnover`, `foul_drawn`, `offensive_rebound`.

#### D.2 Model Training (XGBoost)
- Train an XGBoost multiclass classifier.
- Perform hyperparameter tuning with cross-validation.
- Evaluate: accuracy, F1 per class, confusion matrix.
- Export model as `.json` or `.pkl` to `ml/models/`.

#### D.3 Prediction API Wrapper
- Create a Python class `PossessionPredictor` with a single method:
  ```python
  def predict(self, game_state: GameState) -> PossessionOutcome
  ```
- Loads the trained model once at import time.
- Accepts the same feature vector format the engine will produce.

**Deliverable:** A trained XGBoost model saved to disk + `PossessionPredictor` class.

---

### Phase E: ML Integration into Engine  [SEQUENTIAL after C + D]

**Priority:** HIGH — This is where the "intelligence" kicks in.
**Depends on:** Phase C (working engine) + Phase D (trained model).
**Can be parallel with:** Nothing (needs both C and D done).
**Team allocation:** 1 person (integration) + 1 person (testing/validation).

#### E.1 Replace Heuristics with ML Predictions
- In the possession loop, when the engine needs to decide the outcome of a shot/pass/dribble, call `PossessionPredictor.predict()` instead of weighted random.
- Keep the state machine transitions the same — only the outcome probabilities change.

#### E.2 Feature Vector Construction
- At each decision point, build the feature vector from current `GameState`:
  - Ball handler attributes, defender attributes, game context.
  - This must match exactly the feature columns used in Phase D training.

#### E.3 Validation & Calibration
- Run 100+ simulated games and compare outcome distributions (points per game, shooting percentages, turnovers) against real NBA averages.
- If distributions are off, recalibrate the model or adjust feature weights.
- Document the simulated-vs-real gap for each stat.

#### E.4 Performance Optimization
- XGBoost inference is fast, but running it for every action in a game (≈200 possessions × 3–5 actions each = 600–1000 inferences) should still be < 1 second total.
- Profile and confirm no bottlenecks.

**Deliverable:** The engine now uses ML for possession outcome prediction. Simulated stats are within ±10% of real NBA averages.

---

### Phase F: Streamlit UI — Full Application  [STARTS in parallel with C, completes after E]

**Priority:** MEDIUM (can scaffold early).
**Depends on:** Phase A (schemas), Phase B (team data), Phase E (final engine for full integration).
**Can be parallel with:** Phases C–E (scaffolding and mock-based pages).
**Team allocation:** 1–2 people.

#### F.1 Page Structure (Streamlit Multi-Page)

| Page | Route | Purpose | Depends On |
|---|---|---|---|
| Home | `/` | User registration (name), tutorial, settings (sound toggle, theme) | Nothing |
| Team Setup | `/setup` | Select teams, customize rosters, edit player attributes | Phase B |
| Bracket Editor | `/bracket` | Interactive single-elimination bracket builder | Phase A schemas |
| Simulation Runner | `/simulate` | Start simulation, progress bar, live scoreboard | Phase E |
| Match Result | `/match/<id>` | Box score, quarter-by-quarter breakdown, 2D playback | Phase E + Phase G |
| Tournament | `/tournament` | Full bracket view with results, advance winners | Phase E |

#### F.2 Session State Management
- Use `st.session_state` to persist: selected teams, tournament bracket, current match log, user preferences.
- Avoid global variables; keep state clean and serializable.

#### F.3 Simulation Progress Feedback
- Since Streamlit is single-threaded and re-renders on each interaction, the simulation **must** run in a background thread or as a pre-computed batch.
- **Strategy:** User clicks "Simulate Match" → engine runs to completion in < 3 seconds → Streamlit loads the result page with the full `match_log.json`. Use `st.progress()` with a polling mechanism if needed.
- No real-time streaming during simulation — this is a deliberate tradeoff for simplicity.

#### F.4 Box Score & Stats Display
- Read `match_log.json` box score section.
- Render styled tables with `st.dataframe` or `st.table`.
- Highlight top performers, show shooting charts, play-by-play timeline.

**Deliverable:** A fully navigable Streamlit app with all 6 pages working end-to-end.

---

### Phase G: 2D Court Visualization  [SEQUENTIAL after match_log is stable]

**Priority:** LOW-MEDIUM — Polish feature.
**Depends on:** Phase E (final match_log.json structure).
**Can be parallel with:** Phase F (UI) and Phase H (LLM).
**Team allocation:** 1 person.

#### G.1 Court Rendering
- Use `matplotlib` to draw a simplified half-court or full-court diagram.
- Court lines: 3-point arc, key, baseline, sideline.
- Players rendered as labeled dots with team colors.

#### G.2 Key Moment Playback
- From `match_log.json`, extract "key moments" (field goals, turnovers, steals).
- For each key moment, show 2–3 frames:
  - Frame 1: ball handler position (interpolated from possession clock).
  - Frame 2: pass trajectory (line from passer to receiver).
  - Frame 3: shot arc (from shooter to rim) and outcome (made = green, miss = red).
- Display as a slideshow or auto-advancing animation using `st.empty()` + `time.sleep()`.

#### G.3 Integration into Match Result Page
- Embed the court visualization in the Match Result page below the box score.
- Let users scrub through key moments.

**Deliverable:** Animated 2D court view embedded in Streamlit showing key match moments.

---

### Phase H: LLM Sports Narration  [PARALLEL with G, after E]

**Priority:** LOW — Cool factor, not core functionality.
**Depends on:** Phase E (final match_log.json structure).
**Can be parallel with:** Phase G (2D visualization), Phase F finalization.
**Team allocation:** 1 person.

#### H.1 Prompt Engineering
- Design a system prompt for the LLM:
  ```
  You are a dramatic basketball play-by-play announcer. Given a JSON match log,
  produce an exciting 3-paragraph game recap covering: opening highlights, key
  turning points, and closing moments. Use Brazilian Portuguese (or English),
  energetic tone, and reference player names and stats from the log.
  ```
- Experiment with different prompt variants for tone, length, and language.

#### H.2 Log-to-Prompt Compiler
- Extract from `match_log.json`:
  - Final score.
  - Top 3 performers (PTS, REB, AST).
  - Key moments (lead changes, clutch shots, big runs).
  - Quarter-by-quarter score progression.
- Format as a compact text blob appended to the system prompt.

#### H.3 LLM API Integration
- Support at least one provider: OpenAI (GPT-4o-mini for cost) or Groq (Llama 3, free tier).
- Add a configurable API key in `config/settings.yaml`.
- Call the API **after** the simulation completes; run in a background thread.
- Show a spinner ("Generating narration…") on the result page. Display narration text when ready.

#### H.4 Fallback & Error Handling
- If the API call fails (timeout, rate limit, no key), show a static template-based recap instead (no narration, just stats).
- Never block the result page from loading because the LLM is slow.

**Deliverable:** Dynamic, LLM-generated game recap displayed on the Match Result page.

---

### Phase I: Tournament Bracket Logic  [STARTS after C, completes after E]

**Priority:** MEDIUM.
**Depends on:** Phase A (schemas), Phase E (engine for match simulation).
**Can be parallel with:** Phase F (UI pages), G, H.
**Team allocation:** 1 person.

#### I.1 Bracket Data Structure
- Support 4, 8, or 16-team single-elimination brackets.
- Represent as a binary tree with byes for non-power-of-2 sizes.
- JSON schema for bracket state:
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

#### I.2 Bracket Editor UI
- Drag-and-drop or dropdown-based team assignment to bracket slots.
- Streamlit doesn't support true drag-and-drop natively; use selectboxes arranged in a visual bracket layout.

#### I.3 Tournament Simulation
- "Simulate All" button: iterates through all round-1 matches, determines winners, populates round-2 slots, and repeats until champion.
- Progress bar across all matches.
- Each match result is individually viewable.

#### I.4 Bracket Display
- Visual bracket tree using styled HTML/CSS inside `st.markdown()` or a Plotly Sankey-like diagram.
- Winners advance visually. Champion highlighted.

**Deliverable:** Full tournament mode: build bracket → simulate all → view champion.

---

### Phase J: Final Polish & Testing  [SEQUENTIAL after all modules]

**Priority:** MEDIUM — Quality assurance.
**Depends on:** Everything above.
**Can be parallel with:** Nothing (final phase).
**Team allocation:** Entire team.

#### J.1 End-to-End Integration Testing
- Full flow: User opens app → picks teams → builds bracket → simulates → views box score + 2D playback + narration.
- Test with different team counts, custom players, edge cases (all players foul out, overtime, blowout).

#### J.2 Performance Profiling
- Ensure match simulation (with ML) completes in < 3 seconds for a full game.
- Ensure LLM narration does not block UI rendering.
- Memory usage check for large brackets (16 teams × 15 matches = 15 simulated games).

#### J.3 UI/UX Polish
- Consistent styling (custom Streamlit theme via `.streamlit/config.toml`).
- Error messages for missing data, API failures.
- Loading spinners, progress bars, empty states.

#### J.4 Documentation
- `README.md` with setup instructions, architecture diagram, how to run.
- Docstrings on key engine and ML functions.
- Demo video or screenshots for the presentation.

**Deliverable:** Production-ready, documented, tested application.

---

## 4. Parallelism & Dependency Map

```
Phase A: Contracts & Scaffolding
   │
   ├──► Phase B: Data Acquisition ──► Phase D: ML Training ──┐
   │         (parallel with C)          (parallel with C)     │
   │                                                          │
   └──► Phase C: Engine Core ─────────────────────────────────┼──► Phase E: ML Integration
             (parallel with B)                                │         (sequential after C+D)
                                                              │              │
                                                              │              ▼
                                                              │    ┌─────────┴──────────┐
                                                              │    ▼                    ▼
                                                              │ Phase F: UI  ◄──── Phase I: Tournament
                                                              │    │                    │
                                                              │    ▼                    ▼
                                                              │ Phase G: 2D   Phase H: LLM
                                                              │    │                    │
                                                              │    └────────┬───────────┘
                                                              │             ▼
                                                              └──────► Phase J: Final Polish
```

### Summary of What Can Happen in Parallel

| Parallel Group | Phases | Team Split |
|---|---|---|
| **Group 1** (after A) | B (Data) + C (Engine) | 2 on B, 2 on C |
| **Group 2** (after B, C) | D (ML Training) + F scaffold (UI) | 1 on D, 1 on F |
| **Group 3** (after E) | G (2D) + H (LLM) + I (Tournament) + F finalize | 1 each |

### Sequential Gates (Must Happen in Order)

1. **A** must finish first (schemas are the contract).
2. **E** cannot start until both **C** and **D** are complete.
3. **J** cannot start until all other phases are complete.
4. **F** (full UI) can scaffold early but needs **E** for real data.
5. **G** and **H** need the final `match_log.json` structure from **E**.

---

## 5. Risk Management & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| `nba_api` package is deprecated or rate-limited | HIGH — No real player data | Medium | Implement Basketball-Reference scraper as fallback (Phase B.2). Cache all API responses locally. |
| XGBoost model performs no better than heuristics | MEDIUM — ML adds no value | Low-Medium | Fall back to weighted random with calibrated probabilities from real NBA averages. ML is a bonus, not a requirement for the simulator to function. |
| Streamlit re-renders break long-running simulation | HIGH — App freezes | Medium | **Simulation runs to completion before UI renders results.** No real-time streaming. Use `@st.cache_data` for static assets. |
| LLM API is slow or unavailable | LOW — Narration is non-critical | Medium | Implement static template fallback (Phase H.4). Narration is a "nice to have," not core. |
| Team member availability gaps | MEDIUM — Work blocked | Medium | Phases are designed with clear interfaces. One person's module can progress using mock data that conforms to the schema contract from Phase A. |
| Scope creep (too many features) | HIGH — Won't finish on time | Medium | The plan is split into MUST (A-E, F basic), SHOULD (F full, I), and NICE (G, H). If time is tight, drop G and H first. |

---

## 6. Suggested Timeline

Assuming ~4–6 weeks of part-time work (typical for a semester project with 5 people):

| Week | Milestone | Phases Completed |
|---|---|---|
| **Week 1** | Schemas locked, repo scaffolded, first data pulled | A, B.1–B.2 started |
| **Week 2** | Engine simulates a game with heuristics, data cleaned | B done, C.1–C.3 done |
| **Week 3** | ML model trained, engine + ML integrated | D done, E done |
| **Week 4** | UI fully functional, tournament logic working | F done, I done |
| **Week 5** | 2D visualization, LLM narration, polish & testing | G, H, J done |
| **Week 6** | Buffer, demo prep, documentation | J finalized |

**Critical Path:** A → B → D → E → F → J
**Buffer:** If any phase slips, Weeks 5–6 absorb it. If Week 4 is tight, drop G and H (they are independent polish features).

---

*This plan is a living document. Update it as phases are completed, dependencies shift, or scope changes are decided by the team.*