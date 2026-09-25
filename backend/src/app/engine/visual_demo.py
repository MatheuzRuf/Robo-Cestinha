"""Demonstração interativa da quadra em uma grade ASCII."""

import json
import random
from app.data_ingestion.schemas import validate_processed_output
from app.engine.entities import LiveTeam
from app.engine.match_runner import MatchRunner
from app.engine.grid import GRID_WIDTH, GRID_HEIGHT, RIM_A, RIM_B


def load_data():
    """Carrega e valida os dados usados pela demonstração."""
    with open("data/processed/players.json", "r") as f:
        players_json = json.load(f)
    with open("data/processed/teams.json", "r") as f:
        teams_json = json.load(f)
    return validate_processed_output(players_json, teams_json)

def print_court(state):
    """Imprime as cestas e os jogadores na grade atual da quadra."""
    court = [[" " for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
    
    # As letras A e B indicam as cestas nas extremidades da grade.
    court[RIM_A[1]][RIM_A[0]] = "A"
    court[RIM_B[1]][RIM_B[0]] = "B"
    
    # H representa o mandante; A representa o visitante.
    for p in state.home_team.get_on_court_players() + state.away_team.get_on_court_players():
        pos = p.court_pos
        team_char = "H" if p.team_id == state.home_team.team_id else "A"
        court[pos.y][pos.x] = team_char

    print("-" * (GRID_WIDTH + 2))
    for row in reversed(court):
        print("|" + "".join(row) + "|")
    print("-" * (GRID_WIDTH + 2))

def run_visual_demo():
    """Executa apenas o primeiro quarto, pausando após cada ação."""
    players, teams = load_data()

    # Usa os mesmos dois times da demonstração textual.
    home = next(t for t in teams if t.team_id == "lal")
    away = next(t for t in teams if t.team_id == "bos")

    home_team = LiveTeam.from_team_and_players(home, players)
    away_team = LiveTeam.from_team_and_players(away, players)

    runner = MatchRunner(home_team, away_team, seed=123)
    
    print("Starting match simulation...")
    # A demonstração mostra somente o primeiro quarto para permanecer curta.
    
    q1 = 0
    # O acesso ao estado permite renderizar a posição depois de cada ação.
    state = runner.state
    
    for q in range(1, 2): # Just quarter 1 for demo
        print(f"\n--- Quarter {q} ---")
        while not state.clock.is_quarter_ended():
            possession = runner.fsm.resolve_possession(state)
            
            print(f"\nPossession for {possession.team}:")
            for action in possession.actions:
                print(f"  - {action.type}: {action.result} (Player: {action.player})")
                print_court(state)
            
            state.tick_players_on_court(possession.duration_s)
            
            if input("Continue? (y/n): ").lower() == 'n':
                return

if __name__ == "__main__":
    run_visual_demo()
