# Backend Spec 01 — Database Models

Depends on Spec 00 (project structure must exist first). Defines the SQLAlchemy models for a minimal working stub — enough to create a session, seed teams into a bracket, and claim a team. `MatchEvent` / `MatchFrameChunk` are intentionally excluded from this pass (no engine wiring yet).

Location: `backend/src/app/db/`.

---

## 1. `db/base.py`

```python
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

(`settings.database_url` comes from Spec 02's `core/config.py` — if implementing this spec before Spec 02, stub `settings` with a plain hardcoded connection string temporarily and replace once `config.py` exists.)

---

## 2. Models (`db/models/`)

One file per model, all importing `Base` from `db/base.py`. Use `uuid` primary keys (Python `uuid.uuid4`, stored as Postgres `UUID`) for every table — this project has no auto-increment identity needs and UUIDs avoid collisions across future distributed pieces (e.g. multiple backend instances).

### `db/models/team.py`
Global catalog — not session-scoped (matches the existing `data/processed/teams.json` catalog).
```python
import uuid
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)

    players: Mapped[list["Player"]] = relationship(back_populates="team")
```

### `db/models/player.py`
```python
import uuid
from sqlalchemy import String, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    team: Mapped["Team"] = relationship(back_populates="players")
```
`attributes` is a stub placeholder (JSON blob) until the real stat fields from `data/processed/attributes_table.csv` are mapped — do not try to guess concrete stat columns in this pass.

### `db/models/session.py`
```python
import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="session", foreign_keys="User.session_id")
    matches: Mapped[list["Match"]] = relationship(back_populates="session")
```
`owner_id` is nullable at the DB level because the owning `User` row references this `Session` via FK too — insertion order requires creating the `Session` first without an owner, then the `User`, then updating `owner_id`. Handle that ordering in the service layer later (out of scope here).

### `db/models/user.py`
```python
import uuid
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    join_sequence: Mapped[int] = mapped_column(Integer, nullable=False)  # the "#01", "#02" display number
    name: Mapped[str] = mapped_column(String, nullable=False)
    team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)

    session: Mapped["Session"] = relationship(back_populates="users", foreign_keys=[session_id])
    team: Mapped["Team | None"] = relationship()
```
`join_sequence` is a plain integer assigned incrementally per session (1, 2, 3...) — not a DB identity column, since it must reset per-session, not be globally unique. Assignment logic belongs in the service layer, not the model.

### `db/models/match.py`
```python
import uuid
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_in_round: Mapped[int] = mapped_column(Integer, nullable=False)

    home_team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    away_team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)

    next_match_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=True)
    next_match_slot: Mapped[str | None] = mapped_column(String, nullable=True)  # "home" | "away"

    status: Mapped[str] = mapped_column(String, nullable=False, default="locked")  # locked|ready|live|finished
    home_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    away_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    winner_team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)

    session: Mapped["Session"] = relationship(back_populates="matches")
```

### `db/models/__init__.py`
```python
from app.db.models.team import Team
from app.db.models.player import Player
from app.db.models.session import Session
from app.db.models.user import User
from app.db.models.match import Match

__all__ = ["Team", "Player", "Session", "User", "Match"]
```
Import all models here so `Base.metadata` (used by Alembic) sees every table when this module is imported — SQLAlchemy only registers a model with `Base` once its class body executes.

---

## 2. First Alembic migration

After models exist, from `backend/`:
```
alembic revision --autogenerate -m "initial tables"
alembic upgrade head
```
Verify the generated migration includes all 5 tables before applying — autogenerate occasionally misses a relationship-only change, but for a first migration on empty models this should be a clean 1:1 create.

---

## 3. Non-goals for this spec
- `MatchEvent` and `MatchFrameChunk` tables — added once the engine integration spec exists.
- Any seed data / loading `teams.json` into the `teams` table — separate spec.
- Any service-layer logic (session creation, join-sequence assignment, bracket seeding) — separate spec, this is models only.