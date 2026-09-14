export type Team = 'home' | 'away';

export interface PlayerState {
  id: string;
  team: Team;
  x: number; // feet
  y: number; // feet
}

export interface BallState {
  x: number;
  y: number;
}

export interface Frame {
  players: PlayerState[];
  ball: BallState;
}