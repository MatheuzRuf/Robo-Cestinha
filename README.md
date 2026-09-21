# Robo Cestinha — Predictive Basketball Simulator

Statistical basketball tournament simulator (MC 857 course project, by Team Robô
Cestinha). Single-elimination NBA-style tournaments: a possession-level state
machine resolves outcomes **heuristically from real player statistics** (no ML),
with optional LLM narration and a 2D court broadcast.

The detailed plan (`plan.md`), architecture (`docs/ARCHITECTURE.md`), and
per-module docs (`docs/`) are separate — this README covers how the pieces fit
together and **how to run the app**, starting fresh.

## Architecture in one paragraph

A **React 19 + Vite + TypeScript** frontend (`frontend/`) renders the UI — Home
and the Match Broadcast (live 2D court, scoreboard, play-by-play, commentary).
A **FastAPI** backend (`backend/`) owns all rules: sessions, bracket seeding,
and (planned) the live match simulation, which lives headless in
`backend/src/app/engine/`. **PostgreSQL** (Docker) persists the team/player
catalog plus session/match data. A one-off data pipeline
(`backend/src/app/data_ingestion/`) scrapes NBA 2025-26 stats into JSON files
that both the engine and the DB seed consume.

> ⚠️ **Note on the frontend:** the pages are currently **mock-powered**. They
> render fully without the backend using `frontend/src/mock/` — the Home and
> Match Broadcast pages don't call the API yet (wiring is plan phase D/BACKLOG
> items `SI-02…SI-05`).

## Repository layout

```
backend/                  FastAPI app (Python 3.14)
├── src/app/
│   ├── api/              FastAPI routers + Pydantic schemas (thin)
│   ├── core/             config & secrets (only place allowed to read env)
│   ├── db/               SQLAlchemy models, session, seed script
│   ├── domain/           services + repositories (sessions, bracket)
│   ├── engine/           headless match simulation (state machine, heuristics)
│   └── data_ingestion/   one-off NBA data pipeline (fetch/derive)
├── scripts/              bootstrap / dev / migrate / reset-db
├── alembic/              DB migrations
└── docker-compose.yml    PostgreSQL 16
frontend/                 React + Vite + TypeScript app
├── src/pages/            Home, MatchBroadcast (one folder per route)
├── src/components/       shared UI (Button, Card, Modal, …)
├── src/hooks/, src/lib/, src/config/, src/types/, src/mock/
├── src/styles/tokens.css design tokens (colors/spacing/typography)
└── src/lib/i18n/         en-US / pt-BR locale files
data/processed/           committed pipeline outputs (players.json, teams.json, …)
docs/                     ARCHITECTURE, BACKLOG, statistics, data_ingestion
.spec/                    design specs (home page, backend setup, court)
plan.md                   implementation plan with live status table
Makefile                  bootstrap/dev/migrate/reset-db/format targets
```

`backend/AGENTS.md` and `frontend/AGENTS.md` describe the coding conventions for
each half (layering rules, CSS Modules + tokens, i18n, etc.).

## Project status (where things stand)

Full per-item status lives in `plan.md` (Status Overview) and
`docs/BACKLOG.md`; summary:

| Phase | Title | Status |
|---|---|---|
| A | Data contracts & scaffolding | ✅ done |
| B | Data acquisition & cleaning | ✅ done (582 players / 30 teams, 2025-26) |
| C | Engine core (state machine) | 🟡 partial — headless runner works; fouls, subs, timeouts, tests pending |
| D | Full app (React + FastAPI) | 🟡 partial — Home + Match Broadcast (mock); Team Locker/Bracket/Tournament pages, real endpoints missing |
| E | 2D court visualization | 🟡 partial — React/SVG broadcast done (mock frames); stored-frame replay pending |
| F | LLM narration | ⛔ not started (commentary is static mock text) |
| G | Tournament bracket | 🟡 partial — backend seeding done; UI + simulation advancement pending |
| H | Testing & polish | ⛔ not started (no test suite; frontend is mock-backed) |

## Prerequisites

- **uv** — Python project manager (installs Python 3.14 per `.python-version`).
- **Docker** with `docker compose` — runs the PostgreSQL 16 container.
- **Node.js ≥ 20 + npm** — for the frontend.

No preinstalled Python/Node versions needed; `uv` handles the Python side and
`npm install` the Node side.

## Running the app

Two processes, two terminals. The backend needs Postgres (Docker); the
frontend is standalone (mock data).

### 1. Backend (API + Postgres)

```bash
# first time only: .env from example, uv sync, start Postgres, run migrations
make bootstrap

# every dev session afterwards
make dev          # ensures Postgres is up, migrates, uvicorn --reload on :8000
```

`make dev` blocks in the foreground (uvicorn with auto-reload). Verify:

- `curl http://localhost:8000/health` → `{"status":"ok"}`
- Interactive API docs: <http://localhost:8000/docs> (OpenAPI at `/openapi.json`)

**Seed the team/player catalog** (only needed once — required before creating
sessions, which pick from the catalog teams):

```bash
cd backend && uv run python -m app.db.seed
```

This loads `data/processed/teams.json` + `players.json` into Postgres. It skips
if the catalog already has teams; to re-seed, `make reset-db` (wipes the volume)
and run it again. Try the one live endpoint:

```bash
curl -X POST localhost:8000/sessions -H 'content-type: application/json' \
     -d '{"owner_name": "Luigi"}'
# → creates a Session + owner User + an 8-team bracket (Match rows)
```

### 2. Frontend (React app)

```bash
cd frontend
npm install      # first time only (locks to package-lock.json)
npm run dev      # Vite dev server on :5173
```

Open <http://localhost:5173>:

| Route | Page | What it shows |
|---|---|---|
| `/` | Home | host/join session UI (mock), display-name prompt (saved to localStorage), recent sessions |
| `/match-demo` | Match Broadcast | live court animation, scoreboard with speed/pause, play-by-play, commentary, timeline scrubber |

Both pages run entirely on mock data (`src/mock/mockEngine.ts`,
`src/pages/MatchBroadcast/data/mockMatchData.ts`) — no backend needed.

### Makefile targets

| Target | What it does |
|---|---|
| `make bootstrap` | create `backend/.env` from `.env.example`, `uv sync`, `docker compose up -d db`, alembic migrate |
| `make dev` | same DB setup as bootstrap, then `uvicorn app.api.main:app --reload` |
| `make migrate` | `alembic upgrade head` |
| `make reset-db` | `docker compose down -v` (wipes data), re-create + migrate |
| `make format` / `format-check` | `ruff format` on `backend/` |
| `make stop` | tear down the DB container + kill uvicorn |

## Frontend tour (understanding the code)

Stack: **React 19 + TypeScript + Vite**, CSS Modules (`*.module.css`, no inline
styles, colors always via `var(--…)` tokens in `src/styles/tokens.css`),
**Framer Motion** for animation, a small custom **i18n** layer (en-US/pt-BR).

- **Routing** — there is no router library yet: `App.tsx` checks
  `window.location.pathname` and renders `<MatchBroadcast />` for
  `/match-demo`, `<Home />` otherwise. Adding routes later on top is trivial.
- **Pages are thin** — `pages/Home/Home.tsx` and
  `pages/MatchBroadcast/MatchBroadcast.tsx` compose shared components from
  `src/components/` (`AppShell`, `Button`, `Card`, `Modal`, `SegmentedControl`,
  `TextInput`, `StatusBadge`, `Chip`, `CheckboxRow`, …). AppShell wraps every
  page (top nav + online/session pills).
- **Match Broadcast data flow** — `useGameFrames` (hook) calls
  `startMockEngine` (`src/mock/mockEngine.ts`), which emits a `Frame`
  (`src/types/game.ts`: players + ball position + optional pass/shot
  trajectory) every 800 ms. Frames queue up (max 5) and play at a
  transition duration controlled by speed (1×/1.5×/2×) and pause. The
  `CourtStage`/`Court`/`Player`/`Ball` components render each frame as an SVG
  court (real NBA dimensions in `src/config/court.ts`, 1 ft = 10 SVG units),
  and framer-motion animates positions between frames. Scoreboard, play-by-play
  and commentary columns append mock entries on an interval.
- **i18n** — `src/lib/i18n/` has a tiny context provider: `t('home.hero.title')`
  resolves dot-paths against the active locale (`detectLocale()` reads
  localStorage then `navigator.language`). Every user-facing string must be
  added in **both** `locales/en-US.ts` and `locales/pt-BR.ts`.
- **Commands** — `npm run dev` (serve), `npm run build` (`tsc -b && vite
  build`), `npm run lint` (oxlint), `npm run format` / `format:check`
  (prettier), `npm run preview` (serve the production build).
- **Conventions** — read `frontend/AGENTS.md`: feature-based structure,
  shared-dumb-components, no data fetching inside shared components, no
  business logic in pages.

The `frontend/README.md` is still the default Vite template boilerplate —
ignore it; this README and `frontend/AGENTS.md` are the source of truth.

## Backend tour

Stack: **FastAPI + SQLAlchemy 2 (async) + Alembic + PostgreSQL**, one-way
dependency rule: `api → domain → db`, and `engine`/`data_ingestion` know
nothing about sessions/users/HTTP (see `backend/AGENTS.md`).

- **API** — `api/main.py` mounts routers `GET /health` and `POST /sessions`
  (CORS allowed origin defaults to `http://localhost:5173`, env
  `API_CORS_ORIGINS`). Routers are thin: they parse and delegate to
  request-scoped services from `api/factories.py`.
- **Domain** — `domain/sessions/` (create session + owner) and
  `domain/bracket/` (seed an N-team single-elimination bracket as linked
  `Match` rows where later rounds start `locked`).
- **Engine** — `engine/` is a headless possession-loop simulator
  (`state_machine.py`, `heuristics.py`, `clock.py`, `match_runner.py`). Run a
  LAL × BOS demo from the **repo root** (demo.py uses relative paths):
  ```bash
  uv run python -m app.engine.demo
  ```
  It simulates a full match possession by possession (~4 min) and prints the
  final score. Not yet exposed through the API (plan C/BACKLOG items).
- **Data pipeline** — see next section.
- **Commands** — `make format`/`format-check` (ruff); lint via
  `uv run --extra dev ruff check backend`.

## Data ingestion pipeline

The module moved — it now lives at `backend/src/app/data_ingestion/` and runs
from the repo root with the installed package name `app`:

```bash
# Stage 1 (network) + Stage 2 (derive): fetch if needed, then build outputs
cd backend && uv run python -m app.data_ingestion

# force a full re-fetch of every raw dataset from stats.nba.com
uv run python -m app.data_ingestion --refresh

# derive only, offline from the local raw cache (fails if cache incomplete)
uv run python -m app.data_ingestion --no-fetch
```

Two deliberately split stages:

1. **Fetch** — ~38 throttled `stats.nba.com` calls (once), each response saved
   verbatim to `data/raw/2025_26/` (gitignored).
2. **Derive** — pure offline pandas: rosters + season totals + clutch +
   starter/bench splits + Basketball-Reference positions into the final JSON.

Tunables (season, shrinkage, stamina curve, throttle) live in
`backend/src/app/data_ingestion/config.py`. Full machinery: `docs/data_ingestion.md`.

Outputs (in `data/processed/`, **committed to git**):

| File | Contents |
|---|---|
| `players.json` | 582 players, 12 simulator attributes (+ `position5`, `is_starter`) |
| `teams.json` | 30 teams: rosters + pace / off/def ratings |
| `attributes_table.csv` | raw + derived per-player stats (ML inputs) |
| `data_quality.json` | coverage & sanity report |

## Environment & tooling

- **Python** is managed by **uv** (Python 3.14 pinned in `.python-version`).
  `.venv` is gitignored; `uv sync` regenerates it from `pyproject.toml` +
  `uv.lock`. Use `uv add` / `uv remove` to change deps; the Makefile and
  scripts call everything through `uv run`.
- **Backend deps:** FastAPI, uvicorn, SQLAlchemy 2, psycopg, alembic,
  python-dotenv, pydantic, plus nba-api / pandas / polars / pyarrow / numpy for
  the pipeline (dev extras: pytest, pytest-asyncio, httpx, ruff).
- **Frontend deps:** React 19, react-dom, framer-motion (dev: Vite, TypeScript,
  oxlint, prettier, @vitejs/plugin-react). `package-lock.json` is committed.
- **Secrets:** `backend/.env` (gitignored, created from `.env.example` by
  `make bootstrap`) — only `DATABASE_URL` today, override `API_CORS_ORIGINS`
  there too. Never read env vars outside `backend/src/app/core/secrets.py`.
- **No Docker available?** Point `DATABASE_URL` in `backend/.env` at any
  reachable Postgres (e.g. a local install) instead of the container — the
  scripts assume the Docker service, but the app only needs a PG 16+ database
  with the Alembic schema applied.

## Docs index

- `plan.md` — implementation plan + live status table per phase.
- `docs/ARCHITECTURE.md` — target architecture (frontend/backend/persistency).
- `docs/BACKLOG.md` — fine-grained backlog (SI-…, TS-…, F-… items).
- `docs/statistics.md` — **how every player attribute is computed** (formulas,
  worked examples, caveats).
- `docs/data_ingestion.md` — pipeline machinery (fetch/derive stages).
- `docs/presentation_data_ingestion.md` — data-ingestion presentation material.
- `.spec/` — design specs (design tokens/components, backend setup, court,
  home page).
- `backend/AGENTS.md`, `frontend/AGENTS.md` — coding conventions per half.

### Basketball-Reference positions (only needed when re-running the pipeline)

The NBA only publishes G/F/C; the classic PG/SG/SF/PF/C come from a
Basketball-Reference page you save **once** from a browser (Cloudflare blocks
scripts) into `data/raw/2025_26/bballref_nba_2026_totals.html`. The pipeline
refuses to derive without it. 30-second setup: see `docs/statistics.md §7`. The
parsed result is cached (`bballref_positions.json`), so offline re-derives
never need the HTML again.