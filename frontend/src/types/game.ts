export type Team = 'home' | 'away';

export interface PlayerState {
  id: string;
  team: Team;
  x: number; // feet
  y: number; // feet
  name: string;
  nbaPlayerId?: number | null;
  number?: number;
  position: string;
  stamina?: number;
}

export interface BallState {
  x: number;
  y: number;
  height?: number;
  /** True while the ball is held by a player (rendered beside the portrait). */
  isHeld?: boolean;
}

export interface BallTrajectory {
  type: 'pass' | 'shot';
  from: BallState;
  to: BallState;
  fromTeam: Team;
  toTeam: Team;
  progress?: number;
}

export interface Frame {
  players: PlayerState[];
  ball: BallState;
  trajectory?: BallTrajectory;
}
