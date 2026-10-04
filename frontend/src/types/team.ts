import type { SessionHash } from './session';

export type TeamClaimStatus = 'available' | 'locked_by_you' | 'locked_by_other';

export interface PlayerAttributes {
  twoPointPct: number;
  threePointPct: number;
  freeThrowPct: number;
  turnoverRate: number;
  foulRate: number;
  reboundRate: number;
  assistRate: number;
  stealRate: number;
  blockRate: number;
  stamina: number;
  clutchFactor: number;
  usageRate: number;
}

export interface TeamPlayer {
  id: string;
  name: string;
  position: string;
  positionGroup: string;
  isStarter: boolean;
  attributes: PlayerAttributes;
}

export interface TeamStatistics {
  pace: number;
  offensiveRating: number;
  defensiveRating: number;
}

export interface LockerTeam {
  id: string;
  name: string;
  abbreviation: string;
  season: string;
  statistics: TeamStatistics;
  players: TeamPlayer[];
  claimStatus: TeamClaimStatus;
}

export interface TeamLockerContext {
  sessionHash: SessionHash;
  userId: string;
}

export interface LockTeamInput extends TeamLockerContext {
  teamId: string;
}

export interface TeamLockerSnapshot {
  sessionHash: SessionHash;
  teams: LockerTeam[];
  myTeamId: string | null;
  openTeamCount: number;
  totalTeamCount: number;
}

export type TeamServiceErrorCode = 'team_unavailable' | 'already_claimed' | 'team_not_found' | 'storage_unavailable';

export class TeamServiceError extends Error {
  constructor(code: TeamServiceErrorCode) {
    super(code);
    this.name = 'TeamServiceError';
  }
}
