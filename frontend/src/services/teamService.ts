import { API_BASE_URL } from '../config/api';
import type { LockTeamInput, TeamLockerContext, TeamLockerSnapshot, TeamServiceErrorCode } from '../types/team';
import { TeamServiceError } from '../types/team';

const TEAM_SERVICE_ERROR_CODES = new Set<TeamServiceErrorCode>([
  'team_unavailable',
  'already_claimed',
  'team_not_found',
]);

async function readSnapshot(response: Response): Promise<TeamLockerSnapshot> {
  if (response.ok) return (await response.json()) as TeamLockerSnapshot;

  let code: TeamServiceErrorCode = 'request_failed';
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === 'string' && TEAM_SERVICE_ERROR_CODES.has(payload.detail as TeamServiceErrorCode)) {
      code = payload.detail as TeamServiceErrorCode;
    }
  } catch {
    code = 'request_failed';
  }

  throw new TeamServiceError(code);
}

export interface TeamService {
  getLocker(context: TeamLockerContext): Promise<TeamLockerSnapshot>;
  lockTeam(input: LockTeamInput): Promise<TeamLockerSnapshot>;
}

export const teamService: TeamService = {
  async getLocker(context) {
    const query = new URLSearchParams({ user_id: context.userId });
    const response = await fetch(
      `${API_BASE_URL}/sessions/${encodeURIComponent(context.sessionHash)}/team-locker?${query}`,
    );
    return readSnapshot(response);
  },

  async lockTeam(input) {
    const response = await fetch(
      `${API_BASE_URL}/sessions/${encodeURIComponent(input.sessionHash)}/team-locker/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: input.userId, team_id: input.teamId }),
      },
    );
    return readSnapshot(response);
  },
};
