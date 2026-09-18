# Backend Spec 03 — Team/Player Catalog Seed

Depends on Spec 01 (models) and Spec 02 (config/db wiring). Loads the existing `data/processed/teams.json` and `data/processed/players.json` into the `teams` and `players` tables. Session creation (Spec 04) can't pick real teams until this has run at least once.

Location: `backend/src/app/db/seed.py`.

---

## 1. Important — verify the source JSON shape first

This spec does not have visibility into the exact structure of `data/processed/teams.json` / `players.json`. **Before writing the seed script, open both files and confirm the actual field names** (e.g. does a team have `name` or `team_name`? Does a player reference its team by name or by an id?). The code below assumes a reasonable shape — adjust field access to match reality rather than forcing the data into this shape:

```json
// assumed teams.json shape
[{ "name": "Chicago Steel" }, { "name": "Brooklyn Breakers" }]

// assumed players.json shape
[{ "name": "Marcus Vance", "team": "Chicago Steel", "position": "PG", "...stats": "..." }]
```

If the real files differ meaningfully (e.g. players reference teams by numeric id, or stats live in `attributes_table.csv` separately and need joining first), adjust §2 accordingly — the important invariant is just: every `Player.team_id` must resolve to a `Team` row created in the same run.

---

## 2. `db/seed.py`

```python
import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models import Team, Player

DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"  # adjust if paths.py / config exposes this instead


async def seed_catalog() -> None:
    teams_raw = json.loads((DATA_DIR / "teams.json").read_text())
    players_raw = json.loads((DATA_DIR / "players.json").read_text())

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Team.name))).scalars().all()
        if existing:
            print(f"Catalog already seeded ({len(existing)} teams found) — skipping. "
                  f"Delete rows manually first if you want to re-seed.")
            return

        team_name_to_id: dict[str, uuid.UUID] = {}
        for entry in teams_raw:
            team = Team(id=uuid.uuid4(), name=entry["name"])
            db.add(team)
            team_name_to_id[entry["name"]] = team.id

        for entry in players_raw:
            team_id = team_name_to_id.get(entry["team"])
            if team_id is None:
                print(f"Skipping player {entry.get('name')!r} — unknown team {entry.get('team')!r}")
                continue
            db.add(Player(
                id=uuid.uuid4(),
                team_id=team_id,
                name=entry["name"],
                attributes={k: v for k, v in entry.items() if k not in ("name", "team")},
            ))

        await db.commit()
        print(f"Seeded {len(team_name_to_id)} teams and {len(players_raw)} players.")


if __name__ == "__main__":
    asyncio.run(seed_catalog())
```

The idempotency check (skip if any `Team` rows already exist) is intentionally coarse — good enough for a stub/dev seed script. Don't build upsert/diff logic here; if the catalog needs to change later, clearing the tables and re-running is fine at this stage.

Run with: `python -m app.db.seed` from `backend/src`.

---

## 3. Non-goals for this spec
- Handling partial/corrupt source data gracefully beyond the one `print`-and-skip case shown.
- Re-seeding/upsert logic, or running this automatically on app startup — it's a manual one-off command for now.
- Loading `attributes_table.csv` or `data_quality.json` — only `teams.json`/`players.json` are in scope; fold in richer stats later once `Player.attributes`'s real shape is decided.