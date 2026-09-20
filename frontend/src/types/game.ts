export type Team = 'home' | 'away';

export interface PlayerState {
  id: string;
  team: Team;
  x: number; // feet
  y: number; // feet
  name: string;
  number: number;
  position: string;
}

export interface BallState {
  x: number;
  y: number;
}

export interface BallTrajectory {
  type: 'pass' | 'shot';
  from: BallState;
  to: BallState;
}

export interface Frame {
  players: PlayerState[];
  ball: BallState;
  trajectory?: BallTrajectory;
}
