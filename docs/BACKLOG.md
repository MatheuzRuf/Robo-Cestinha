# Robô Cestinha — Backlog

High-level backlog, organized by user-facing area plus the engine/backend work underneath it. Not a replacement for `.spec/` — just visibility into what's done, in progress, and still ahead.

Status flags: `[x]` done, `[ ]` not started, `[~]` in progress / status needs confirming.

## Foundations

- [x] `F-01` Design system: tokens, shared components (Button, Card, Modal, etc.)
- [x] `F-02` i18n setup (en-US, pt-BR)
- [x] `F-03` Backend project structure, DB models, migrations
- [x] `F-04` Catalog seeded from data ingestion (teams/players)
- [x] `F-05` Architecture docs, frontend/backend conventions (AGENTS.md)
- [~] `F-06` Data ingestion pipeline (scraping/normalizing team & player data) — files exist, completeness unconfirmed

## Simulation Engine

This is the core of the product and likely has the most real work left. Breaking down what a match sim needs — please correct which of these are actually done vs. still placeholder:

- [~] `SE-01` Core game loop / clock management (quarters, possessions, shot clock)
- [~] `SE-02` Possession state machine (who has the ball, transitions between states)
- [ ] `SE-03` Shot selection heuristics (when a player shoots, from where, shot type)
- [ ] `SE-04` Shot outcome resolution (make/miss based on player attributes, defense, shot difficulty)
- [ ] `SE-05` Passing / ball movement logic between possessions
- [ ] `SE-06` Defensive logic (matchups, help defense, steals, blocks)
- [ ] `SE-07` Fouls, free throws, turnovers
- [ ] `SE-08` Rebounding logic (offensive/defensive)
- [ ] `SE-09` Player fatigue / substitutions (if in scope)
- [ ] `SE-10` Mapping player attributes → in-game behavior (how stats actually influence outcomes)
- [ ] `SE-11` Calibration/tuning — do simulated results look statistically realistic against real player data?
- [ ] `SE-12` Engine output shaped as `MatchEvent`/`MatchFrameChunk` (currently only designed on paper, not confirmed wired to real engine output)

## Session Setup & Identity

- [x] `SI-01` Backend: create a session, seed the bracket
- [ ] `SI-02` Backend: join a session, claim a team
- [ ] `SI-03` Frontend: Home page wired to the real API (currently mock-only)
- [ ] `SI-04` Frontend: display-name modal, saved per device
- [ ] `SI-05` Session-hash collision handling, join_sequence race condition (known gaps from spec)

## Team Selection

- [ ] `TS-01` Team Locker page — browse catalog, view roster/stats
- [ ] `TS-02` Claim a team; locked in once confirmed
- [ ] `TS-03` "Available teams" logic for late joiners

## Tournament Bracket

- [ ] `TB-01` Bracket Tree page — visualize rounds and match state
- [ ] `TB-02` Locked/ready/live/finished states reflected visually
- [ ] `TB-03` Navigate from bracket into a specific match

## Live Match Broadcast

- [x] `LB-01` Match Broadcast page UI (mock data — court, scoreboard, play-by-play, commentary feed)
- [ ] `LB-02` Match Coordinator — connects the simulation engine's real output to the DB and SSE (blocked on Simulation Engine being far enough along)
- [ ] `LB-03` Real-time frames/events over SSE, replacing the mock engine
- [ ] `LB-04` Commentary Generator — groups events, calls an AI model for narration

## Match Replay

- [ ] `MR-01` Replay page — play back a finished match from stored frames/events
- [ ] `MR-02` Shared frame-source interface (live vs. replay, same rendering path)

## Quality & Ops

- [ ] `QO-01` Test coverage for domain services and engine
