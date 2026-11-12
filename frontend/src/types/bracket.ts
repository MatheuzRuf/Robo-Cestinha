export interface BracketContext {
  sessionHash: string;
  userId: string;
}

export interface BracketTeam {
  id: string;
  name: string;
  abbreviation?: string | null;
  nba_team_id?: number | null;
}

export interface BracketMatch {
  match_id: string | null;
  slot: number;
  status?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  winner_team_id?: string | null;
  home_team: BracketTeam | null;
  away_team: BracketTeam | null;
}

export interface BracketRound {
  round_number: number;
  matches: BracketMatch[];
}

export interface BracketSnapshot {
  generated: boolean;
  can_generate: boolean;
  rounds: BracketRound[];
}
