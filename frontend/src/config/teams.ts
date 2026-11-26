import type { Team } from '../types/game';

export const TEAM_COLORS: Record<Team, string> = {
  home: 'var(--color-team-blue)',
  away: 'var(--color-team-red)',
};

export const BALL_COLOR = '#f97316';
export const PLAYER_RADIUS = 18;
export const BALL_RADIUS = 8;
