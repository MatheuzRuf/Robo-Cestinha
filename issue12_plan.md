# Issue 12 — Real Match Simulation via the Engine (Spec-Driven Implementation Plan)

Status: **draft — specification for review**. Nothing is implemented yet.
Verification approach: **spec-driven development (SDD)** — for every layer we first
lock the contract with tests (a *spec), then implement the smallest thing that
satisfies it. The order below follows that discipline.

The authoritative design reference is `docs/backend-engine-integration.md`. This
plan restates it as reviewable *requirements + tests*, reconciled with what the
code actually looks like today (the design doc predates parts of the current tree
and differs from it in a few details, flagged under **Reconciliations**).

---

## 1. Goal & scope

Turn `POST /matches/{match_id}/simulation` from a mock responder into a real
endpoint that:

1. loads the persisted match/session/teams/players from Postgres,
2. runs the bounded iteration engine on stored player attributes,
3. persists a unique simulation plus ordered events and frame chunks,
4. records the final score/winner and advances the bracket winner atomically,
5. returns a response that exactly matches `frontend/src/types/matchBroadcast.ts`.

### In scope

- New `db/models` (`MatchSimulation`, `MatchEvent`, `MatchFrameChunk`) + Alembic
  migration `0004_match_simulation_results.py`.
- Engine refactor to a transition-based boundary (`StateMachine.resolve_next_transition`,
  `MatchRunner.run_match(max_iterations)`) producing frames/events + overtime tie-break.
- `domain/matches/`: `MatchService`, `MatchRepository`, `MatchEngineAdapter`,
  domain `types.py`, and domain error classes.
- `api/schemas/match_simulation.py`, the real route in `routers/matches.py`, and a
  `match_service()` factory method.
- Config for the positive `iterations` upper bound.
- Tests at every layer (spec-first).

### Out of scope (explicit)

- **No** timeline or stream endpoint. **No** `GET /matches/{match_id}/simulation` or
  any simulation/read endpoint. The POST response is the only source of frames/events
  sent to the frontend.
- No probability-rule changes. Stored player attributes pass to the engine unchanged.
- No automatic retry of failed runs (operational recovery later).
- Changing the frontend's `/match-demo` fallback (`MatchBroadcast` → `matchId="demo"`)
  is **out of scope in this issue but required before production**: the real API rejects
  non-persisted IDs, so the demo path will 404. We add a test asserting the API
  rejects a non-persisted `match_id`, and record the frontend navigation as a follow-up
  (see §9).

---

## 2. Current state (ground truth from the code)

| Area | File(s) | What is there today |
|---|---|---|
| Route | `backend/src/app/api/routers/matches.py` | `POST /{match_id}/simulation` reads `sessionHash`+`iterations` from body (`iterations>0` only), calls `factory.mock_simulation_service()`, returns a dict. No DB, no engine, **no UUID path validation, no error mapping, returns 200**. |
| Mock | `backend/src/app/domain/matches/service.py` | `MockSimulationService.run_simulation()`; emits 94×50-style `x,y`, `ball.height`, `trajectory.progress`, `number` on players, 5 players/team, capped at `MAX_DEMO_FRAMES=72`. Not persisted. |
| Domain | `backend/src/app/domain/` | `sessions/` (service+repo) and `bracket/` (service+repo) are the only business areas. `matches/` has only `service.py`. `base_repository.py` provides `add/add_all/flush/commit/refresh`. Repos use `AsyncSession`; services never touch it. AGENTS.md layering enforced. |
| DB models | `backend/src/app/db/models/` | `Match` (session_id, round, slot_in_round, home/away_team_id, next_match_id, next_match_slot "home"/"away", status "locked"/"ready", scores, winner_team_id); `Session` (hash unique); `Team` (catalog_id slug, abbreviation, team_stats); `Player` (team_id, attributes JSON, catalog_id slug, position, position5, is_starter). **No simulation/event/frame tables.** |
| Engine | `backend/src/app/engine/` | Clock-based full-match runner. `MatchRunner.run_match()` runs 4×12-min quarters, returns a `MatchLog` (quarters/possessions/actions). `StateMachine.resolve_possession()` loops a whole possession to an outcome. `entities.py` `LiveTeam.from_team_and_players()` builds teams; `grid.py` is a **10×5** grid (x 0..9, y 0..4); `schemas.py` has `MatchLog/ActionLog/PossessionLog/...`, **no frames/transition/result types**. |
| Ingestion schema | `backend/src/app/data_ingestion/schemas.py` | `Player`/`PlayerAttributes`/`Team` (12 attrs: two_pt_pct…usage_rate) — the existing, validated player-attribute contract the engine already consumes. |
| API wiring | `backend/src/app/api/factories.py`, `main.py` | `ServiceFactory` builds request-scoped repos/services from a session. `matches.router` mounted at `/matches`. |
| Config | `backend/src/app/core/config.py`, `core/secrets.py` | `Settings` only has `database_url` + `api_cors_origins`. **No simulation-iteration cap yet.** |
| Frontend contract | `frontend/src/types/matchBroadcast.ts` | `SimulationResponse` — the exact shape the API must satisfy (see §3.2). |
| Alembic | `backend/alembic/versions/0001…0003` | Existing migrations. Next is `0004`. |
| Tests | `backend/tests/` | `api/test_matches.py` (calls `simulate_match` directly with `ServiceFactory(db=None)`), `domain/test_match_simulation.py` (mock), repo tests use **`FakeDatabase` stubs** (no live DB), `db/test_seed.py` (pure catalog). No `tests/engine/`. |

### Reconciliations (where the design doc ≠ current code)

1. **Response `match` field**: the design doc's §5 example shows `"sessionId"`;
   the frontend contract uses `"sessionHash"`. **We follow the frontend** (issue:
   "matches the current frontend contract"). Recorded here so it doesn't regress.
2. **`SimulationPlayer.number`**: present in the frontend type and the mock, but the
   `Player` model/seed has no jersey `number`. We emit `null`/omit it (field is
   optional in the frontend). Adding a real jersey number is a separate data change
   (see Open Questions).
3. **"Natural end" of a match vs. the clock**: the current engine is clock-driven
   (4 quarters of game time). The API contract forbids any time field. Decision: the
   engine **keeps its internal clock to define natural game end (4 quarters)** and never
   exposes time; `iterations` is a cap on transitions. This matches design §3.3
   ("run normal transitions until the match ends **or** iterations is reached"). See
   Open Questions Q2.
4. **Grid → court coordinates**: engine is a 10×5 grid; API is 0..94 × 0..50. The
   adapter converts linearly (see §3.4).
5. **`get_recorded_simulation`**: the design doc's repository/service stubs include a
   read path; the issue removes the read endpoint. **We do not add it** (no GET, no
   storage-only retrieval in this issue).
6. The design doc's Step 1 ("hardcoded POST first") is superseded by the issue: we go
   straight to the engine-backed route and **delete** `MockSimulationService` and its
   `mock_simulation_service()` factory method instead of keeping a stopgap.

---

## 3. The spec

### 3.1 Functional requirements (each maps to acceptance tests)

- **F1** `POST /matches/{match_id}/simulation` validates the request body
  (`sessionHash` non-empty, `1 <= iterations <= <upper bound>`).
- **F2** The match must exist and belong to the session named by `sessionHash`.
- **F3** The match must have both teams assigned and be `status == "ready"`.
- **F4** If F2 fails → `404 match_or_session_not_found`. If F3 fails →
  `409 match_not_ready`. If the match already has a simulation → `409
  match_already_simulated`. If validation fails → `422 invalid_iterations`. Any
  unexpected engine/persistence failure → `500 simulation_failed`. (Table in §3.3.)
- **F5** Exactly **one** simulation may ever run per match; enforcement is a **DB
  unique constraint**, not a Python status check. Concurrent/duplicate requests do not
  call the engine twice.
- **F6** The engine runs seeded from stored `Player.attributes` (all 12), unchanged,
  and bounded by `iterations`. No probabilities change.
- **F7** The run yields exactly **N+1 frames** for N completed transitions
  (initial frame at iteration 0 plus one frame after each transition).
- **F8** Every frame has exactly **one** scalar `playerWithBallId` value or `null`.
- **F9** Events carry a global `sequence` and reference an existing `iteration`.
- **F10** A tied score at natural end or at the iteration limit triggers overtime
  until one team scores; `overtimeIterations` may exceed `iterationsLimit`.
- **F11** On success, score/status/winner and next-match advancement persist in **one
  transaction with the events + frame chunks**; any failure rolls back the whole
  completion (no finished match without its bracket update; a failed run never writes a
  winner or advances the bracket).
- **F12** Response status is `201 Created`.
- **F13** No game-clock / elapsed-seconds / animation-duration field appears in the
  response or persisted frames.
- **F14** Non-persisted `match_id` (e.g. `"demo"`) is rejected (`404`).

### 3.2 API contract

#### Request

```
POST /matches/{match_id}/simulation
Payload: { "sessionHash": "RC-2026-XXXX-XXX", "iterations": 300 }
```

`match_id` is a UUID in the path. `simulations` ≥ 1.

#### Response (`201 Created`) — shape per `SimulationResponse`

FastAPI `response_model` lives in `api/schemas/match_simulation.py`. All fields
exactly as in the frontend type:

```jsonc
{
  "match":     { "matchId": "<uuid>", "sessionHash": "<hash>", "status": "finished" },
  "simulation":{
    "status": "completed",
    "iterationsLimit": 300,
    "iterationsCompleted": 300,
    "overtimeIterations": 1,
    "terminationReason": "overtime_score"   // see enum below
  },
  "teams": {
    "home": { "teamId": "<uuid>", "name": "...", "abbreviation": "..." },
    "away": { "teamId": "<uuid>", "name": "...", "abbreviation": "..." }
  },
  "players": [
    { "playerId": "<uuid>", "teamId": "<uuid>", "side": "home", "name": "...",
      "position": "PG", "number": null }                 // number is optional|null
  ],
  "frames": [{
    "iteration": 0,
    "playerWithBallId": "<player-uuid> | null",
    "players": [ { "playerId": "<uuid>", "x": 47, "y": 25 } ],   // all 10 on-court
    "ball": { "x": 47, "y": 25, "height": 0, "trajectory": null },
    "score": { "home": 0, "away": 0 },
    "possessionTeamId": "<team-uuid> | null"
  }],
  "events": [{
    "sequence": 1, "iteration": 0, "type": "game_started",
    "teamId": "<uuid>|null", "playerId": "<uuid>|null",
    "targetPlayerId": "<uuid>|null", "data": {}
  }],
  "summary": { "homeScore": 0, "awayScore": 0, "winnerTeamId": "<uuid>" }
}
```

**Ball/trajectory.** `trajectory` is optional. When present for a pass/shot transition
it carries `type: "pass"|"shot"`, `fromPosition`, `toPosition`, `fromPlayerId`,
`toPlayerId`, `fromTeamId`, `toTeamId`, `progress`. When the ball is with a holder,
`trajectory` is `null` and `x/y` equal the holder's `x/y`. `ball.height` optional.
All coordinates are the **mapped 0..94 × 0..50** space.

**Data rules (validated by Pydantic + tests):**
- `0 <= x <= 94`, `0 <= y <= 50`.
- `iterations` strictly increasing starting at 0; each step increments by 1.
- Every frame's `players` is the same 10-player set (one entry per player id, no dups).
- A frame has exactly one `playerWithBallId` value or `null`.
- `match.status == "finished"`, `simulation.status == "completed"`.

**`terminationReason` enum** (single source of truth, shared by schema + engine):
`normal_end` | `iteration_limit` | `overtime_score`.

**Required `event.type` values** (superset the engine may emit):
`game_started`, `pass_completed`, `pass_intercepted`, `shot_attempted`, `shot_made`,
`shot_missed`, `free_throw_made`, `turnover`, `rebound`, `foul`,
`possession_changed`, `overtime_started`, `game_finished`.

`shot_made` / `free_throw_made` **must** carry `data.pointsScored` and `data.scoreAfter`
(`{home,away}`). `shot_attempted` carries `data.shotValue`.

#### Errors (stable details, FastAPI `HTTPException`)

| HTTP | `detail` | Trigger |
|---|---|---|
| 404 | `match_or_session_not_found` | session hash unknown, or match not in that session |
| 409 | `match_not_ready` | game already finished/simulated (reservation block), not ready, or both teams missing |
| 409 | `match_already_simulated` | a simulation row already exists (running/completed/failed) for the match — duplicate request |
| 422 | `invalid_iterations` | `iterations < 1` or `iterations > <upper bound>`; bad `sessionHash`/`match_id` |
| 500 | `simulation_failed` | engine or commit exception after a reservation |

### 3.3 Domain contract (`domain/matches/`)

`domain/matches/types.py` — **plain dataclasses, no Pydantic/FastAPI** (AGENTS rule):

- `MatchContext`: session/match ids, `MatchStatus`, both `Team`+`list[Player]` DB rows
  (or pre-parsed engine teams + the id map), plus `next_match_id`, `next_match_slot`.
- `SimulationRecord`: the reserved row fields.
- `MatchSimulationResult`: `frame_count`, `iterations_completed`, `overtime_iterations`,
  `home_score`, `away_score`, `winner_team_id`, `termination_reason`, `events` (list of
  db-ready event tuples), `frame_chunk` (first chunk) `engine_version`, `random_seed`.
- `EngineIdMap`: `team_id_by_catalog_id`, `player_id_by_catalog_id`.

`domain/matches/service.py` — `MatchService`:
- `simulate_match(session_hash, match_id, iterations) -> MatchSimulationResult`
  workflow: `get_match_context` → `reserve_simulation` → build engine input via adapter →
  run engine in `asyncio.to_thread` (no DB txn open) → map IDs → `complete_simulation`.
  On engine exception → `fail_simulation` + re-raise → mapped to `500`.

`domain/matches/repository.py` — `MatchRepository(BaseRepository)`. All DB access here.
- `get_match_context(session_hash, match_id)` — resolves session by hash, loads match
  + both teams + all their players; raises `MatchOrSessionNotFoundError`,
  `MatchNotReadyError`. (Does **not** create a reservation.)
- `reserve_simulation(match_id, iterations) -> MatchSimulation` — INSERT row
  (`status="running"`) relying on the unique constraint + a transaction (`SELECT FOR
  UPDATE` on the match row, insert, commit/rollback); raises `MatchAlreadySimulatedError`
  on `IntegrityError`. Returns the row (id, random_seed).
- `complete_simulation(simulation_id, result, *, winner_team_id, ...)` — one txn:
  update simulation to `completed`; insert events + first frame chunk; set match
  scores/`winner_team_id`/`status="finished"`; write winner into
  `next_match.{next_match_slot}` and set it `"ready"` when both team slots are filled;
  commit (roll back all on any failure).
- `fail_simulation(simulation_id, error_code)` — mark simulation `failed`
  (`termination_reason=error_code`), **no** match/bracket change.

Domain errors (in `domain/matches/errors.py`):
`MatchOrSessionNotFoundError`, `MatchNotReadyError`, `MatchAlreadySimulatedError`,
`InvalidIterationsError`, `SimulationFailedError`.

### 3.4 Engine contract (`engine/`)

Add to `engine/schemas.py`:

- `TransitionResult` — one atomic action outcome: `action_type`, `player_id`,
  `target_player_id`, `outcome`, `points`, `score_before/after`, `possession_team_id`
  (before/after), `defending_team_id`, `from_pos`, `to_pos`, `ball_in_flight: bool`
  (pass/shot), `is_three`, event hints.
- `SimulationFrame` — `iteration`, `player_with_ball_id`, `players: list[PlayerPosition]`,
  `ball: BallState`, `score`, `possession_team_id`.
- `SimulationEvent` — `sequence`, `iteration`, `type`, `team_id`, `player_id`,
  `target_player_id`, `data`. (snake_case inside engine; adapter converts to API camel.)
- `EngineSimulationResult` — `frames`, `events`, `iterations_completed`,
  `overtime_iterations`, `home_score`, `away_score`, `winner_team_id`,
  `termination_reason`.

`engine/state_machine.py`: add `resolve_next_transition(state) -> TransitionResult`
that performs **exactly one** action (the current `resolve_possession` inner loop
becomes a loop calling this; keep `resolve_possession` for internal/narration use or
remove if nothing else calls it). No clock/time exposed.

`engine/match_runner.py`: add `run_match(max_iterations) -> EngineSimulationResult`:
- initialize state (existing `__init__`), capture initial frame (iteration 0),
- loop `resolve_next_transition`; capture a frame after each transition;
- stop on natural end (4 quarters elapsed via internal clock) or `max_iterations`;
- if tied at that point → overtime (`start_next_period(is_overtime=True)`) until a
  team scores (counts toward `overtime_iterations`);
- emit events with a global `sequence` (raise `game_started`, `game_finished`,
  `possession_changed`, `shot_*`, `pass_*`, etc.), and set `termination_reason`.
- Guarantee termination: every transition returns an outcome (no unbounded loop).

**Event mapping** (engine action → one or more events, per F9/F-Set):

| Engine action / state change | Simulation event(s) |
|---|---|
| start of run | `game_started` (iteration 0) |
| PASS success | `pass_completed` (player=passer, target=receiver) |
| PASS intercepted | `pass_intercepted` (team=defender, player=stealer) + `possession_changed` |
| SHOOT | `shot_attempted` (data.shotValue) then `shot_made`\|`shot_missed` |
| made shot | `shot_made` (data: `pointsScored`, `scoreAfter`) + `possession_changed` if possession flips |
| missed shot → rebound | `shot_missed`, `rebound`, (+ `possession_changed` if defense rebound) |
| foul | `foul` (free throws → `free_throw_made` with `pointsScored`, `scoreAfter`) |
| turnover / shot-clock violation | `turnover` + `possession_changed` |
| overtime begins | `overtime_started` |
| run ends | `game_finished` (data.winnerTeamId) |

Only mapped, contract event types are emitted. Movement without an outcome produces a
frame only (frames are dense; events are sparse).

**Mapping rules (adapter)**
- **Attributes:** `Player.attributes` (JSON dict of the 12 fields) →
  `data_ingestion.PlayerAttributes` (validates) unchanged.
- **Engine input IDs:** use `Team.catalog_id` / `Player.catalog_id` as engine ids so
  `LiveTeam.from_team_and_players()` works unchanged against the ingestion schema.
- **Engine→DB id map:** `EngineIdMap` maps every catalog id → the row's UUID.
  Every `player_id`/`team_id` in frames, events, score summary, and winner is
  translated to a DB UUID before persistence/response.
- **Coordinates:** `x_api = round(x_grid * 94 / 9)`, `y_api = round(y_grid * 50 / 4)`
  (grid 0..9/0..4 → 0..94/0..50). Trajectories are converted the same way.
- **ball.height / trajectory.progress:** the engine has none; the adapter sets
  `height=0`; `trajectory` is emitted for pass/shot transitions with `progress` set so
  the frontend animation is self-contained, else `null`. (Semantics decision — see
  Open Questions Q3.)

### 3.5 Persistence contract

New models in `backend/src/app/db/models/` (each own file, exports updated):

`MatchSimulation`
- `id` UUID pk; `match_id` UUID **unique** FK → `matches.id`; `status`
  (`running|completed|failed`); `iterations_limit`, `iterations_completed`,
  `overtime_iterations` ints; `termination_reason` str|null; `random_seed` int|null;
  `engine_version` str|null; `started_at` dt; `completed_at` dt|null.
- The `match_id` **unique** constraint is the concurrency/duplicate guard (F5).

`MatchEvent`
- `id` pk; `simulation_id` FK; `sequence` int; `iteration` int; `type` str;
  `team_id`,`player_id`,`target_player_id` UUID|null; `payload` JSON.
- **unique `(simulation_id, sequence)`.**

`MatchFrameChunk`
- `id` pk; `simulation_id` FK; `chunk_index` int; `first_iteration` int;
  `frame_count` int; `frames` JSON (list of frame dicts).
- **unique `(simulation_id, chunk_index)`**; fixed initial `CHUNK_SIZE = 100` in one
  named constant; no row-per-position.

`Match` — add `simulation` relationship; **no new bracket columns** (scores/winner live
on `Match`).

Alembic `0004_match_simulation_results.py`: create the three tables with all FKs,
indexes (`match_id` unique, `(simulation_id, sequence)` unique, `(simulation_id,
chunk_index)` unique), and the `Match.simulation` relationship. Down = drop tables.

**Transaction rules**
- Reservation = its own transaction (no engine work inside).
- Completion = **one** transaction: simulation→`completed`, events, chunk, match
  score/winner/status, next-match advancement; all-or-nothing.
- Failure: `fail_simulation` marks `failed`, writes nothing else.
- Engine runs in `asyncio.to_thread` with no DB session/txn open (F11).

### 3.6 Configuration

`core/config.py` `Settings` gains `max_simulation_iterations: int`. Read through
`SecretsProvider` (env `MAX_SIMULATION_ITERATIONS`) with a sane default (propose
`1000`). Router/service validate `1 <= iterations <= max_simulation_iterations`
→ `InvalidIterationsError` → `422`.

---

## 4. Architecture & layering (AGENTS.md-compliant)

```
Router (parse + validate + map errors)  ──>  MatchService (workflow)
                                                 ├─> MatchRepository (all SQLAlchemy)
                                                 ├─> MatchEngineAdapter (mapping only)
                                                 └─> MatchRunner/StateMachine (engine, sync)
```

- API never queries the DB or touches the engine.
- Domain never imports FastAPI/Pydantic and never holds a session.
- Engine knows nothing about FastAPI/SQLAlchemy/sessions/API coordinates.
- Repos own every query/write; router stays thin; service composes.
- `ServiceFactory.match_service()` builds `MatchService(MatchRepository(db),
  MatchEngineAdapter())` request-scoped.

---

## 5. Implementation order (spec-first: write the failing spec, then implement)

Each step ends green. Steps are ordered for independent review.

### Step 0 — Configuration (upper bound)
- Add `max_simulation_iterations` to `Settings` + `SecretsProvider` (default `1000`).
- **Spec test:** `test_core_config.py` — default applied, env override applied.

### Step 1 — API contract locked (schemas + contract tests)
- `api/schemas/match_simulation.py`: `SimulateMatchRequest`, and all response schemas
  (`MatchSummarySchema`, `SimulationSummarySchema`, `TeamPairSchema`,
  `PlayerMetadataSchema`, `SimulationFrameSchema`, `PlayerPositionSchema`,
  `BallSchema`/`TrajectorySchema`, `ScoreSchema`, `SimulationEventSchema`,
  `FinalMatchSummarySchema`), camelCase fields.
- Pydantic validators: `iterations` bounds; frame `x/y` 0..94/0..50; monotonic
  iterations; `playerWithBallId` present-or-`null`; exactly-10 players; event required
  fields (`shot_made`/`free_throw_made` have `pointsScored`+`scoreAfter`).
- **Spec tests:** `tests/api/test_match_simulation_schema.py` — construct valid +
  invalid payloads, assert pass/reject (validates contract before any engine exists).

### Step 2 — Persistence (models + migration + repository + DB-ish tests)
- Add the three models + relationships; export in `models/__init__.py`.
- `MatchRepository` methods against the model. Unit-test with a `FakeDatabase` stub
  (mirroring `test_bracket_repository.py`): `get_match_context` rules (session/matches/
  teams/players/ready), reserve duplicate raises, completion sets events+chunk+scores+
  winner+advance, fail leaves bracket untouched.
- Add migration `0004`. (Migration is reviewed but live-DB execution is optional; see
  Open Questions Q4.)

### Step 3 — Engine transition boundary (engine + engine tests)
- `engine/schemas.py`: `TransitionResult`, `SimulationFrame`, `SimulationEvent`,
  `PlayerPosition`, `BallState`, `EngineSimulationResult`.
- `StateMachine.resolve_next_transition()`, `MatchRunner.run_match(max_iterations)`
  with initial frame + per-transition frames, tie-break overtime, global `sequence`,
  `termination_reason`.
- **Spec tests:** `tests/engine/test_match_runner.py` — frame count == N+1; iteration
  links on events; no duplicate `playerWithBallId`; scoring; normal end vs
  `iteration_limit`; tied→overtime (`overtime_iterations>0`, winner exists);
  determinism under a fixed seed.

### Step 4 — Adapter (mapping + coordinates + id map)
- `domain/matches/engine_adapter.py`: `build_engine_input(context)` (DB→ingestion
  `Team`/`Player` via catalog ids, attrs unchanged, build `EngineIdMap`);
  `run(context, iterations) -> EngineSimulationResult` (constructs `LiveTeam`s + runs
  engine via `asyncio.to_thread`); `to_domain_result(engine_result, id_map)
  -> MatchSimulationResult` (coordinate + id + trajectory mapping).
- **Spec tests:** `tests/domain/test_match_engine_adapter.py` — attributes preserved;
  catalog→UUID mapping correct; grid→94×50 bounds; event/team/player ids all UUIDs.

### Step 5 — Domain service + error types
- `types.py`, `errors.py`, `MatchService.simulate_match` workflow
  (context → reserve → to_thread run → map → complete; except → fail). Reserve via
  unique constraint, not a status check.
- **Spec tests:** `tests/domain/test_match_service.py` — happy path orchestrates
  repo+adapter; every error path raises the right domain error; failure call
  `fail_simulation` and does not complete/advance.

### Step 6 — Real route + factory (wiring)
- Replace `MockSimulationService` usage: `ServiceFactory.match_service()`; remove
  `mock_simulation_service()`. Delete `MockSimulationService` and its tests.
- `routers/matches.py`: `simulate_match(match_id: UUID, payload: SimulateMatchRequest,
  factory) -> MatchSimulationResponse`, `status_code=201`,
  `response_model=MatchSimulationResponse`; map domain errors → the §3.3 table;
  validate response schema on dev.
- **Spec tests:** `tests/api/test_matches.py` rewritten — happy 201; each error code;
  `"demo"`/non-UUID rejected 404/422; timeline still absent.

### Step 7 — Bracket completion + concurrency safeguards
- In `complete_simulation`: after setting match finished, write `Team.id` of winner into
  `next_match.next_match_slot`; set next match `"ready"` iff both slots filled; final
  match (no `next_match_id`) → bracket is complete (no further table changes; see
  Open Questions Q5).
- **Spec tests:** repository-level: advancement writes correct slot; not-ready until
  both teams; final match finishes cleanly; a mid-write failure rolls back everything.

---

## 6. Testing matrix → acceptance criteria

| Acceptance criterion | Spec / tests |
|---|---|
| Schemas separate from ORM/engine; response matches frontend | Step 1 schema spec; Step 3 engine types; response-model enforcement |
| Match/session association, readiness, team/player loading covered | Step 2 repo spec (`get_match_context`), Step 5 service spec, Step 6 API 404/409 |
| Engine captures ordered frames/events within iteration/overtime + stored attrs | Step 3 runner spec, Step 4 adapter spec (attrs unchanged) |
| Concurrent duplicates safe at DB level; fail runs don't score/advance | Step 7 repo spec (unique constraint, rollback), Step 2 reserve-dup spec; optional live-Postgres test (Q4) |
| Success atomic: persist simulation, update result, advance winner | Step 7 completion spec (single txn) |
| Router/domain/repo/engine/migration/error behavior tested | Steps 2–6 |
| No timeline/stream/read endpoint added | Step 6 negative test (openapi path check, as today) |

---

## 7. File change manifest

**Add**
- `api/schemas/match_simulation.py`
- `domain/matches/repository.py`
- `domain/matches/engine_adapter.py`
- `domain/matches/types.py`
- `domain/matches/errors.py`
- `db/models/match_simulation.py`, `db/models/match_event.py`,
  `db/models/match_frame_chunk.py`
- `alembic/versions/0004_match_simulation_results.py`
- `tests/engine/test_match_runner.py`, `tests/domain/test_match_repository.py`,
  `tests/domain/test_match_service.py`, `tests/domain/test_match_engine_adapter.py`,
  `tests/api/test_match_simulation_schema.py`

**Change**
- `api/routers/matches.py` (real route, UUID, 201, error map)
- `api/factories.py` (drops mock; adds `match_service()`)
- `api/schemas/__init__.py` (exports, per package convention)
- `domain/matches/service.py` (MockSimulationService → MatchService)
- `db/models/match.py` (simulation relationship), `db/models/__init__.py` (exports)
- `engine/schemas.py`, `engine/state_machine.py`, `engine/match_runner.py`
- `core/config.py` (+ `core/secrets.py`) — iteration cap
- `tests/api/test_matches.py` (rewrite), `tests/domain/test_match_simulation.py`
  (remove mock tests)

**Delete** — `MockSimulationService` (and its `mock_simulation_service()` factory method).

---

## 8. Out of scope & follow-ups

- Frontend `/match-demo` fallback must eventually navigate to a **real bracket match
  id** (once a simulation exists from the bracket page). Backend side (rejecting
  `"demo"`) is done here; the frontend routing change is a separate issue.
- Adding a real jersey `number` to players (data + UI) is separate.
- Operational recovery/reset for `failed` simulations is separate.

---

## 9. Open questions (need answers before / during implementation)

1. **Jersey `number`:** `Player` has no jersey number but the frontend type and mock
   emit one. Emit `null`/omit (my recommendation, zero schema risk), or add a real
   `number` field to the `Player` model + seed as part of this issue?
2. **"Natural end" semantics:** keep the engine's internal 4-quarter clock to define
   the match's natural end (time never exposed), with `iterations` purely a transition
   cap — OK? (Alternative: drop the clock and treat `iterations` as the only end
   condition, making "natural end" moot. The design doc implies keeping a clock.)
3. **Trajectory/progress semantics with one-frame-per-transition:** since F7 gives
   exactly N+1 dense frames (no mid-flight "ball in the air" sub-frames), should the
   post-transition frame's `ball.trajectory` describe the just-completed pass/shot
   (with `progress` at the end state) so the frontend can animate arrival? Or should
   we add optional in-flight frames that break the strict N+1 rule? I recommend the
   former (keep N+1 strict).
4. **Live-Postgres tests:** acceptance criteria (concurrency, transaction atomicity,
   unique constraints) are best proven against real Postgres (via the existing
   `docker-compose db`). Existing repo tests are `FakeDatabase`-only. Is a
   Postgres-backed integration test suite acceptable (docker + `pytest` gated on
   `DATABASE_URL_TEST`), or must CI stay DB-less (SQL-level assertions only)?
5. **Tournament-complete signal:** the final match has no `next_match_id`. It's not
   captured as "champion/champion finished." Is finishing the final match enough, or do
   you want a session-level "tournament complete / winner" flag added (extra schema)?

I'll incorporate your answers and can then start with Step 0/1 (spec + schema tests).