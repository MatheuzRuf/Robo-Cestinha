import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import select

from app.data_ingestion.schemas import validate_processed_output
from app.db.base import AsyncSessionLocal
from app.db.models import Player as PlayerModel
from app.db.models import Team as TeamModel

DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"
SEED_TEAM_IDS = ("bkn", "nyk", "bos", "gsw", "okc", "lal", "den", "phi")


def build_catalog_records(
    teams_raw: list[dict], players_raw: list[dict]
) -> tuple[list[TeamModel], list[PlayerModel]]:
    """Build database catalog records for the selected teams and their rosters.

    Args:
        teams_raw: Team records read from teams.json.
        players_raw: Player records read from players.json.

    Returns:
        Team and player database records for the selected catalog teams.

    Raises:
        ValueError: If a selected team is missing from teams.json.
    """

    players, teams = validate_processed_output(players_raw, teams_raw)
    teams_by_id = {team.team_id: team for team in teams}
    missing_team_ids = set(SEED_TEAM_IDS) - teams_by_id.keys()
    if missing_team_ids:
        raise ValueError(
            f"Selected teams are missing from teams.json: {sorted(missing_team_ids)}"
        )

    players_by_id = {player.player_id: player for player in players}
    database_teams: list[TeamModel] = []
    database_players: list[PlayerModel] = []

    for team_id in SEED_TEAM_IDS:
        team = teams_by_id[team_id]
        database_team_id = uuid.uuid4()
        database_teams.append(
            TeamModel(
                id=database_team_id,
                catalog_id=team.team_id,
                name=team.name,
                abbreviation=team.abbreviation,
                team_stats=team.team_stats.model_dump(),
            )
        )

        for player_id in team.roster:
            player = players_by_id[player_id]
            database_players.append(
                PlayerModel(
                    id=uuid.uuid4(),
                    catalog_id=player.player_id,
                    team_id=database_team_id,
                    name=player.name,
                    position=player.position,
                    position5=player.position5,
                    is_starter=player.is_starter,
                    attributes=player.attributes.model_dump(),
                )
            )

    return database_teams, database_players


async def seed_catalog() -> None:
    """Seed the selected processed teams and their players into the database."""

    teams_raw = json.loads((DATA_DIR / "teams.json").read_text())
    players_raw = json.loads((DATA_DIR / "players.json").read_text())
    teams, players = build_catalog_records(teams_raw, players_raw)

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(TeamModel.id))).scalars().all()
        if existing:
            print(
                f"Catalog already seeded ({len(existing)} teams found) - skipping. "
                "Run make reset-db before seeding the selected eight teams."
            )
            return

        db.add_all([*teams, *players])
        await db.commit()
        print(f"Seeded {len(teams)} teams and {len(players)} players.")


if __name__ == "__main__":
    asyncio.run(seed_catalog())
