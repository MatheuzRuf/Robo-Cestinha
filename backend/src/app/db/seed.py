import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import select

from app.db.base import AsyncSessionLocal
from app.db.models import Player, Team

DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"


async def seed_catalog() -> None:
    teams_raw = json.loads((DATA_DIR / "teams.json").read_text())
    players_raw = json.loads((DATA_DIR / "players.json").read_text())

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Team.id))).scalars().all()
        if existing:
            print(
                f"Catalog already seeded ({len(existing)} teams found) - skipping. "
                "Delete rows manually first if you want to re-seed."
            )
            return

        team_id_to_db_id: dict[str, uuid.UUID] = {}
        for entry in teams_raw:
            team = Team(
                id=uuid.uuid4(),
                name=entry["name"],
            )
            db.add(team)
            team_id_to_db_id[entry["team_id"]] = team.id

        skipped_players = 0
        for entry in players_raw:
            team_id = team_id_to_db_id.get(entry["team_id"])
            if team_id is None:
                print(f"Skipping player {entry.get('name')!r} - unknown team {entry.get('team_id')!r}")
                skipped_players += 1
                continue

            db.add(
                Player(
                    id=uuid.uuid4(),
                    team_id=team_id,
                    name=entry["name"],
                    attributes=entry["attributes"],
                )
            )

        await db.commit()
        print(f"Seeded {len(team_id_to_db_id)} teams and {len(players_raw) - skipped_players} players.")


if __name__ == "__main__":
    asyncio.run(seed_catalog())
