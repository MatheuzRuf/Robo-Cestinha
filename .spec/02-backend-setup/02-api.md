# Backend Spec 02 — API Skeleton & Config

Depends on Spec 00 (structure) and Spec 01 (models). Wires up a runnable FastAPI app with health check and DB connectivity — no real business endpoints yet beyond a stub.

Location: `backend/src/app/api/`, `backend/src/app/core/`.

---

## 1. `core/secrets.py`

A single class owns reading secret values from the environment. Nothing else in the codebase calls `os.environ`/`os.getenv` directly — every secret is read through this class, so swapping the source later (e.g. a real secrets manager like AWS Secrets Manager or Vault) only touches this one file.

```python
import os
from dotenv import load_dotenv

load_dotenv()  # loads backend/.env into the process environment, once, at import time


class SecretsProvider:
    """Single seam for reading secrets. Nothing outside this class
    touches os.environ directly."""

    def get(self, key: str, default: str | None = None) -> str:
        value = os.getenv(key, default)
        if value is None:
            raise RuntimeError(f"Missing required secret: {key}")
        return value


secrets = SecretsProvider()
```

Add `python-dotenv` to `pyproject.toml`'s dependencies (Spec 00) for `load_dotenv`.

## 2. `core/config.py`

`Settings` reads everything through `secrets`, not through `pydantic-settings`' automatic env scanning — this keeps the single seam from §1 real (pydantic-settings would otherwise read `os.environ` on its own, bypassing `SecretsProvider`).

```python
from dataclasses import dataclass
from app.core.secrets import secrets


@dataclass(frozen=True)
class Settings:
    database_url: str
    api_cors_origins: list[str]


def load_settings() -> Settings:
    return Settings(
        database_url=secrets.get("DATABASE_URL"),
        api_cors_origins=secrets.get("API_CORS_ORIGINS", "http://localhost:5173").split(","),
    )


settings = load_settings()
```

Drop the `pydantic-settings` dependency from `pyproject.toml` (Spec 00) since it's no longer used — `SecretsProvider` + a plain dataclass replaces it.

---

## 3. `api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routers import health, sessions

app = FastAPI(title="Robô Cestinha API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
```

Run locally with: `uvicorn app.api.main:app --reload` from `backend/src`.

---

## 4. `api/routers/health.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}
```
Purpose: confirms the app boots and can reach Postgres — nothing more.

---

## 5. `api/schemas/session.py`

```python
from pydantic import BaseModel
import uuid


class CreateSessionRequest(BaseModel):
    owner_name: str


class CreateSessionResponse(BaseModel):
    session_hash: str
    owner_user_id: uuid.UUID
```
Stub contract only — fields may grow (e.g. simulation speed, quarter length) once the Home page's create-session form is actually wired to this endpoint; not required for this pass.

---

## 6. `api/routers/sessions.py` (stub only)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.api.schemas.session import CreateSessionRequest, CreateSessionResponse

router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(payload: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    # STUB: real implementation (session row, owner user, bracket seeding)
    # belongs in a domain/sessions/service.py — not written in this pass.
    raise NotImplementedError("Session creation service not yet implemented")
```
This endpoint intentionally raises `NotImplementedError` for now — its purpose in this spec is only to prove the router/schema/app wiring compiles and is reachable (e.g. visible in `/docs`), not to implement session creation. Implementing the real body is a separate spec once `domain/sessions/service.py` is written.

---

## 7. Verify

After implementing:
1. `docker compose up -d` (from `backend/`) to start Postgres.
2. `alembic upgrade head` to apply Spec 01's migration.
3. `uvicorn app.api.main:app --reload`
4. Visit `http://localhost:8000/docs` — should show `/health` and `POST /sessions` in the OpenAPI UI.
5. `GET /health` should return `{"status": "ok"}`.
6. `POST /sessions` should return a 500 with the `NotImplementedError` message — this is expected at this stage, not a bug.

---

## 8. Non-goals for this spec
- Implementing real session-creation logic (bracket seeding, join-sequence assignment) — separate `domain/sessions` spec.
- Any other routers (teams, matches, join).
- Auth — this project has none by design.