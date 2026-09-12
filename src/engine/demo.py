import json
from src.data_ingestion.schemas import validate_processed_output
from src.engine.entities import LiveTeam
from src.engine.match_runner import MatchRunner

def load_data():
    with open("data/processed/players.json", "r") as f:
        players_json = json.load(f)
    with open("data/processed/teams.json", "r") as f:
        teams_json = json.load(f)
    return validate_processed_output(players_json, teams_json)

def run_demo():
    players, teams = load_data()
    
    # Pick two teams
    home = next(t for t in teams if t.team_id == "lal")
    away = next(t for t in teams if t.team_id == "bos")
    
    home_team = LiveTeam.from_team_and_players(home, players)
    away_team = LiveTeam.from_team_and_players(away, players)
    
    runner = MatchRunner(home_team, away_team)
    match_log = runner.run_match()
    
    print(f"Match Result: {match_log.home_team} {match_log.final_score.home} - {match_log.final_score.away} {match_log.away_team}")
    print(f"Total possessions: {sum(len(q.possessions) for q in match_log.quarters)}")

if __name__ == "__main__":
    run_demo()
