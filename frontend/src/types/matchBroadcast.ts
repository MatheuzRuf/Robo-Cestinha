import type { Frame } from './game';

export type Speed = 1 | 1.5 | 2;

export interface TeamSummary {
  abbreviation: string;
  name: string;
  score: number;
  seed: string;
  possession: boolean;
  fouls: { current: number; max: number };
  timeouts: { remaining: number; total: number };
}

export interface PlayByPlayLogEntry {
  id: string;
  gameClock: string;
  type: string;
  description: string;
}

export interface CommentaryEntry {
  id: string;
  gameClock: string;
  text: string;
}

export interface MomentumSnapshot {
  runLabel: string;
  runDelta: string;
  homePoints: number;
  awayPoints: number;
  stats: [string, string][];
}

export interface MatchSnapshot {
  matchId: string;
  matchMeta: string;
  ticker: string;
  home: TeamSummary;
  away: TeamSummary;
  playCall: string;
  shotProbability: number;
  defensiveScheme: string;
  quarter: number;
  gameClock: string;
  shotClock: string;
  elapsedSeconds: number;
  durationSeconds: number;
  momentum: MomentumSnapshot;
  frame: Frame;
  playByPlay: PlayByPlayLogEntry[];
  commentary: CommentaryEntry[];
}

export type MatchUpdatePayload = Partial<
  Omit<MatchSnapshot, 'matchId' | 'matchMeta' | 'frame' | 'playByPlay' | 'commentary' | 'durationSeconds'>
>;

interface BroadcastEventBase {
  sequence: number;
  occurredAt: string;
}

export type BroadcastEvent =
  | (BroadcastEventBase & { type: 'snapshot'; payload: MatchSnapshot })
  | (BroadcastEventBase & { type: 'frame'; payload: Frame })
  | (BroadcastEventBase & { type: 'match_update'; payload: MatchUpdatePayload })
  | (BroadcastEventBase & { type: 'play_by_play'; payload: PlayByPlayLogEntry })
  | (BroadcastEventBase & { type: 'commentary'; payload: CommentaryEntry });

export type MatchStreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
