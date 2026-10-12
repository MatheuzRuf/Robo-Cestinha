export interface BracketContext {
  sessionHash: string;
  userId: string;
}

export interface BracketTeam {
  id: string;
  name: string;
}

export interface BracketMatch {
  match_id: string | null;
  slot: number;
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
