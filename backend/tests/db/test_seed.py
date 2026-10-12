import json

from app.db.seed import DATA_DIR, SEED_TEAM_IDS, build_catalog_records


def test_catalog_records_include_only_selected_teams_and_their_rostered_players():
    teams_raw = json.loads((DATA_DIR / "teams.json").read_text())
    players_raw = json.loads((DATA_DIR / "players.json").read_text())
    source_teams = {team["team_id"]: team for team in teams_raw}
    source_players = {player["player_id"]: player for player in players_raw}

    teams, players = build_catalog_records(teams_raw, players_raw)

    assert tuple(team.catalog_id for team in teams) == SEED_TEAM_IDS
    assert {player.catalog_id for player in players} == {
        player_id
        for team_id in SEED_TEAM_IDS
        for player_id in source_teams[team_id]["roster"]
    }
    assert len(players) == sum(
        len(source_teams[team_id]["roster"]) for team_id in SEED_TEAM_IDS
    )

    teams_by_catalog_id = {team.catalog_id: team for team in teams}
    players_by_catalog_id = {player.catalog_id: player for player in players}
    for team_id in SEED_TEAM_IDS:
        team = teams_by_catalog_id[team_id]
        source_team = source_teams[team_id]
        assert team.name == source_team["name"]
        assert team.abbreviation == source_team["abbreviation"]
        assert team.team_stats == source_team["team_stats"]
        assert not hasattr(team, "season")

        for player_id in source_team["roster"]:
            player = players_by_catalog_id[player_id]
            source_player = source_players[player_id]
            assert player.team_id == team.id
            assert player.name == source_player["name"]
            assert player.position == source_player["position"]
            assert player.position5 == source_player["position5"]
            assert player.is_starter == source_player["is_starter"]
            assert player.attributes == source_player["attributes"]
