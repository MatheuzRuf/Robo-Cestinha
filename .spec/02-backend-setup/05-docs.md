# Backend Spec 05 — Docstrings

Scope: Python backend only (`backend/src/app/`). Applies retroactively to Specs 00–04, and as a standing rule going forward.

## Style

Google-style (`Args:` / `Returns:` / `Raises:`).

```python
async def create_session(db: AsyncSession, owner_name: str, num_teams: int = 8) -> tuple[Session, User]:
    """Create a session with the owner registered as the first user.

    Args:
        db: Active async DB session; commits once on success.
        owner_name: Display name for join_sequence 1.
        num_teams: Teams to seed into the bracket. Must be a power of two.

    Returns:
        The created Session and its owner User.

    Raises:
        ValueError: If fewer than num_teams teams exist in the catalog.
    """
```

## What needs one

Every class, and every function in `domain/`, `db/`, `core/`, and every route handler — one or two sentences is enough; add `Args`/`Returns`/`Raises` only when there's something non-obvious to say.

**Skip:** trivial one-liners, `__init__.py` re-exports, anything that would just restate the function name.

## Apply retroactively

Add docstrings to what Specs 00–04 already defined: the 5 models, `db/base.py:get_db`, `core/secrets.py`, `core/config.py`, `core/ids.py:generate_session_hash` (include the collision caveat from Spec 04 §6), `domain/bracket/service.py:seed_bracket`, `domain/sessions/service.py:create_session`, both route handlers, and the two `CreateSessionRequest`/`Response` schemas.

## Non-goals

No docstring linting setup, no module-level docstrings, no frontend TSDoc (separate spec if wanted).