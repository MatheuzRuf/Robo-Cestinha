# Backend Spec 04 — Session Creation & Bracket Seeding

Depends on Spec 01 (models), Spec 02 (API skeleton), Spec 03 (catalog must be seeded — this fails loudly if fewer than 8 teams exist). Replaces the `NotImplementedError` stub in `POST /sessions` with real logic: create the session, register the owner as user `#01`, pick 8 teams, and build the full bracket tree.

Location: `backend/src/app/core/ids.py`, `backend/src/app/domain/bracket/`, `backend/src/app/domain/sessions/`.

---

## 1. `core/ids.py`

```python
from secrets import token_hex


def generate_session_hash() -> str:
    return f"RC-{token_hex(2).upper()}-{token_hex(2).upper()}"
```
Note: this uses Python's built-in `secrets` module (cryptographically-safe random tokens) — unrelated to `app.core.secrets.SecretsProvider` from Spec 02, which handles environment/config secrets. Same word, two different things; don't merge them.

Collisions against the `sessions.hash` unique constraint are not handled here — at this stage, a retry-on-conflict loop is left as a known gap (see §6).

---

## 2. `domain/bracket/service.py`

Builds a single-elimination bracket for a session, given a list of team ids already chosen. Framework-agnostic beyond taking an `AsyncSession` to add rows — no HTTP/Pydantic concerns.

```python
import math
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Match


async def seed_bracket(db: AsyncSession, session_id: uuid.UUID, team_ids: list[uuid.UUID]) -> None:
    """Creates every Match row for a session's bracket and wires the
    round-to-round progression via next_match_id/next_match_slot.
    team_ids length must already be a power of two - validated by the caller."""
    num_teams = len(team_ids)
    num_rounds = int(math.log2(num_teams))

    rounds: list[list[Match]] = []
    matches_in_round = num_teams // 2
    for round_index in range(num_rounds):
        round_matches = [
            Match(
                id=uuid.uuid4(),
                session_id=session_id,
                round=round_index,
                slot_in_round=slot,
                status="locked",
            )
            for slot in range(matches_in_round)
        ]
        rounds.append(round_matches)
        matches_in_round //= 2

    # Each match in round R feeds match (slot // 2) of round R+1;
    # even slot -> home side of the next match, odd slot -> away side.
    for round_index in range(num_rounds - 1):
        for match in rounds[round_index]:
            next_match = rounds[round_index + 1][match.slot_in_round // 2]
            match.next_match_id = next_match.id
            match.next_match_slot = "home" if match.slot_in_round % 2 == 0 else "away"

    # Round 0 gets its teams filled in immediately and becomes ready to play.
    remaining = list(team_ids)
    for match in rounds[0]:
        match.home_team_id = remaining.pop(0)
        match.away_team_id = remaining.pop(0)
        match.status = "ready"

    for round_matches in rounds:
        db.add_all(round_matches)
```

`team_ids` is expected to already be in the order/shuffle the caller wants — this function doesn't randomize, it just places them pairwise into round 0.

---

## 3. `domain/sessions/service.py`

```python
import random
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Session, User, Team
from app.domain.bracket.service import seed_bracket
from app.core.ids import generate_session_hash


async def create_session(db: AsyncSession, owner_name: str, num_teams: int = 8) -> tuple[Session, User]:
    session = Session(id=uuid.uuid4(), hash=generate_session_hash())
    db.add(session)
    await db.flush()  # assigns session.id without committing yet

    owner = User(
        id=uuid.uuid4(),
        session_id=session.id,
        join_sequence=1,
        name=owner_name,
    )
    db.add(owner)
    await db.flush()

    session.owner_id = owner.id

    result = await db.execute(select(Team.id))
    all_team_ids = [row[0] for row in result.all()]
    if len(all_team_ids) < num_teams:
        raise ValueError(
            f"Not enough teams in catalog ({len(all_team_ids)}) to seed a {num_teams}-team bracket. "
            f"Run the Spec 03 seed script first."
        )
    chosen = random.sample(all_team_ids, num_teams)

    await seed_bracket(db, session.id, chosen)

    await db.commit()
    await db.refresh(session)
    return session, owner
```

`ValueError` here is a temporary stand-in for a proper domain exception type — fine for this stub pass, but flag it as a known gap (see §6) rather than treating it as the final error-handling shape.

---

## 4. Wire it into the router

Replace the stub body in `api/routers/sessions.py` (from Spec 02):

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.api.schemas.session import CreateSessionRequest, CreateSessionResponse
from app.domain.sessions.service import create_session as create_session_service

router = APIRouter()


@router.post("", response_model=CreateSessionResponse)
async def create_session(payload: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    session, owner = await create_session_service(db, owner_name=payload.owner_name)
    return CreateSessionResponse(session_hash=session.hash, owner_user_id=owner.id)
```

The router still does nothing but call the domain function and map the result to the response schema — no business logic added here, per the layering rule in `backend/AGENTS.md`.

---

## 5. Verify

1. Run Spec 03's seed script first — `POST /sessions` will raise if the catalog has fewer than 8 teams.
2. `POST /sessions` with `{"owner_name": "Coach_Vince"}` should return a body like `{"session_hash": "RC-XXXX-YYYY", "owner_user_id": "<uuid>"}`.
3. Query the `matches` table for that `session_id` — should see the correct number of rows for an 8-team bracket (4 quarterfinal + 2 semifinal + 1 final = 7 rows), with round 0's 4 matches having `status = "ready"` and non-null team ids, and all later rounds `status = "locked"` with null team ids.
4. Follow `next_match_id` from a round-0 match — it should point at the correct round-1 match, alternating `next_match_slot` between `"home"` and `"away"` for adjacent round-0 matches.

---

## 6. Known gaps, deliberately deferred
- **Session-hash collisions** are not retried — `generate_session_hash()` could theoretically collide with an existing session's `hash`. Low real-world risk at this scale, but a retry loop (or a DB-level catch-and-retry on the unique constraint) is a fast follow, not required for this stub.
- **Error handling is minimal** — `ValueError` for "not enough teams" isn't mapped to a specific HTTP status yet (FastAPI will currently turn it into an unhandled 500, same as the previous `NotImplementedError` stub did). A proper exception-to-HTTP-status mapping layer is a separate concern once more endpoints exist.
- **No `join`/`select-team` endpoints yet** — this spec only covers creation. Joining a session and claiming a team are separate specs once this is working end-to-end.