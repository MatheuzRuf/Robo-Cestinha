export type Speed = 1 | 1.5 | 2;

export interface SimulationTeam {
  teamId: string;
  nbaTeamId?: number | null;
  name: string;
  abbreviation: string;
}

export interface SimulationPlayer {
  playerId: string;
  nbaPlayerId?: number | null;
  teamId: string;
  side: 'home' | 'away';
  name: string;
  position: string;
  number?: number | null;
}

export interface SimulationFramePosition {
  playerId: string;
  x: number;
  y: number;
}

export interface SimulationFrame {
  iteration: number;
  playerWithBallId: string | null;
  players: SimulationFramePosition[];
  ball: {
    x: number;
    y: number;
    height?: number;
    trajectory?: SimulationTrajectory | null;
  };
  score: { home: number; away: number };
  possessionTeamId: string | null;
}

export interface SimulationTrajectory {
  type: 'pass' | 'shot';
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  fromPlayerId: string | null;
  toPlayerId: string | null;
  fromTeamId: string;
  toTeamId: string;
  progress: number;
}

export interface SimulationEvent {
  sequence: number;
  iteration: number;
  type: string;
  teamId: string | null;
  playerId: string | null;
  targetPlayerId: string | null;
  data: Record<string, unknown>;
}

export interface SimulationResponse {
  match: {
    matchId: string;
    sessionHash: string;
    status: string;
  };
  simulation: {
    status: string;
    iterationsLimit: number;
    iterationsCompleted: number;
    overtimeIterations: number;
    terminationReason: string;
  };
  teams: {
    home: SimulationTeam;
    away: SimulationTeam;
  };
  players: SimulationPlayer[];
  frames: SimulationFrame[];
  events: SimulationEvent[];
  summary: {
    homeScore: number;
    awayScore: number;
    winnerTeamId: string | null;
  };
}
