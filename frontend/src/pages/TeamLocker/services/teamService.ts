import { teamLockerData } from '../data/teamLockerData';
import type { TeamLockerData } from '../types';

export interface TeamService {
  getLockerData(): Promise<TeamLockerData>;
  selectTeam(sessionCode: string, teamId: string, coachHandle: string): Promise<void>;
}

export const teamService: TeamService = {
  async getLockerData() {
    return structuredClone(teamLockerData);
  },

  async selectTeam(_sessionCode, _teamId, _coachHandle) {
    // Mock implementation: the page updates its local view after this resolves.
    // Replace this method with the backend request when team selection is available.
  },
};
