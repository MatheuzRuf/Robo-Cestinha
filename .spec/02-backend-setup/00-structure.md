# Backend Spec 00 — Project Structure & Local Setup

Goal of this spec: reorganize the existing `src/` into a proper installable package alongside a new `backend/` API, and get Postgres running locally. No business logic yet — this is scaffolding only.

---

## 1. New top-level layout

Move the existing `src/` contents into a `backend/` folder, restructured as below. Keep `data/` where it is at the repo root (both engine and API will read from it).

```
robo-cestinha/                      (repo root, unchanged)
├── data/
│   └── processed/                  # unchanged — existing csv/json files
├── frontend/                       # unchanged
├── backend/
│   ├── pyproject.toml              # new — see §2
│   ├── uv.lock
│   ├── alembic.ini                 # new — see §4
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/               # empty for now
│   ├── docker-compose.yml          # new — see §3
│   ├── .env.example                # new — see §3
│   ├── src/
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── core/
│   │       │   ├── __init__.py
│   │       │   ├── secrets.py      # empty stub, see Spec 02
│   │       │   └── config.py       # empty stub, see Spec 02
│   │       ├── db/
│   │       │   ├── __init__.py
│   │       │   ├── base.py         # empty stub, see Spec 01
│   │       │   └── models/
│   │       │       └── __init__.py # empty, models added in Spec 01
│   │       ├── domain/
│   │       │   └── __init__.py     # empty for now, no services yet
│   │       ├── api/
│   │       │   ├── __init__.py
│   │       │   ├── main.py         # empty stub, see Spec 02
│   │       │   ├── schemas/
│   │       │   │   └── __init__.py
│   │       │   └── routers/
│   │       │       └── __init__.py
│   │       ├── engine/             # MOVE existing src/engine/* here as-is
│   │       │   ├── __init__.py
│   │       │   ├── clock.py
│   │       │   ├── demo.py
│   │       │   ├── entities.py
│   │       │   ├── grid.py
│   │       │   ├── heuristics.py
│   │       │   ├── match_runner.py
│   │       │   ├── schemas.py
│   │       │   └── state_machine.py
│   │       └── data_ingestion/     # MOVE existing src/data_ingestion/* here as-is
│   │           ├── __init__.py
│   │           ├── __main__.py
│   │           ├── bballref.py
│   │           ├── config.py
│   │           ├── derive.py
│   │           ├── fetch.py
│   │           ├── ingest_data.py
│   │           ├── normalize.py
│   │           └── schemas.py
│   └── tests/
│       ├── api/
│       ├── domain/
│       └── engine/                 # move any existing engine tests here
```

**Move instructions:**
- `src/engine/*` → `backend/src/app/engine/*` — file contents unchanged, only update internal imports if they reference the old `src.engine.*` path (change to `app.engine.*`).
- `src/data_ingestion/*` → `backend/src/app/data_ingestion/*` — same rule.
- Old top-level `src/`, `pyproject.toml`, `uv.lock` at repo root are removed once the move is verified (`git mv`, not copy, to preserve history).
- Do not modify engine/data_ingestion logic in this pass — this is a pure relocation.

---

## 2. `backend/pyproject.toml`

```toml
[project]
name = "robo-cestinha-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "sqlalchemy>=2.0",
    "psycopg[binary]>=3.2",
    "alembic>=1.14",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
]

[tool.uv.sources]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/app"]
```

(Keep whatever ingestion-related dependencies the old root `pyproject.toml` already had — add them into this file rather than dropping them; they weren't listed here since this spec doesn't have visibility into that file's current contents.)

---

## 3. Local Postgres via Docker Compose

`backend/docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

`backend/.env.example`:
```
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
```

Copy `.env.example` to `.env` (gitignored) for local dev.

---

## 4. Alembic init

Run `alembic init alembic` from inside `backend/` to generate `alembic.ini` and `alembic/env.py`, then point `env.py`'s `target_metadata` at `app.db.base.Base.metadata` (defined in Spec 01 — leave this wiring as a `# TODO: set target_metadata once db/base.py exists` comment if Spec 01 hasn't been implemented yet).

---

## 5. Non-goals for this spec
- No models, no API routes, no business logic — that's Spec 01 and Spec 02.
- No CI/deployment config.
- Don't touch `frontend/` at all.