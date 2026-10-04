import { create } from 'zustand';
import { teamService } from '../services/teamService';
import type { TeamLockerContext, TeamLockerSnapshot } from '../types/team';
import { TeamServiceError } from '../types/team';

type TeamLockerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TeamStoreState {
  sessionHash: string | null;
  userId: string | null;
  snapshot: TeamLockerSnapshot | null;
  selectedTeamId: string | null;
  status: TeamLockerStatus;
  isLocking: boolean;
  errorKey: string | null;
  loadLocker: (context: TeamLockerContext) => Promise<void>;
  selectTeam: (teamId: string) => void;
  lockSelectedTeam: (context: TeamLockerContext) => Promise<TeamLockerSnapshot>;
  reset: () => void;
}

let loadSequence = 0;

function errorKey(error: unknown) {
  if (!(error instanceof TeamServiceError)) return 'team_locker.errors.save_failed';

  switch (error.message) {
    case 'team_unavailable':
      return 'team_locker.errors.team_unavailable';
    case 'already_claimed':
      return 'team_locker.errors.already_claimed';
    case 'team_not_found':
      return 'team_locker.errors.team_not_found';
    case 'storage_unavailable':
      return 'team_locker.errors.storage_unavailable';
    default:
      return 'team_locker.errors.save_failed';
  }
}

export const useTeamStore = create<TeamStoreState>((set, get) => ({
  sessionHash: null,
  userId: null,
  snapshot: null,
  selectedTeamId: null,
  status: 'idle',
  isLocking: false,
  errorKey: null,

  async loadLocker(context) {
    const sequence = ++loadSequence;
    const sameContext = get().sessionHash === context.sessionHash && get().userId === context.userId;
    set({
      sessionHash: context.sessionHash,
      userId: context.userId,
      snapshot: sameContext ? get().snapshot : null,
      selectedTeamId: sameContext ? get().selectedTeamId : null,
      status: 'loading',
      errorKey: null,
    });

    try {
      const snapshot = await teamService.getLocker(context);
      if (sequence !== loadSequence) return;

      const currentSelection = sameContext ? get().selectedTeamId : null;
      const selectionIsValid = snapshot.teams.some(
        (team) =>
          team.id === currentSelection && (team.claimStatus === 'available' || team.claimStatus === 'locked_by_you'),
      );
      set({
        snapshot,
        selectedTeamId: snapshot.myTeamId ?? (selectionIsValid ? currentSelection : null),
        status: 'ready',
      });
    } catch (error) {
      if (sequence !== loadSequence) return;
      set({ status: 'error', errorKey: errorKey(error) });
    }
  },

  selectTeam(teamId) {
    const team = get().snapshot?.teams.find((entry) => entry.id === teamId);
    if (!team) return;
    set({ selectedTeamId: teamId, errorKey: null });
  },

  async lockSelectedTeam(context) {
    const { sessionHash, userId, snapshot, selectedTeamId } = get();
    if (sessionHash !== context.sessionHash || userId !== context.userId || !snapshot || !selectedTeamId) {
      const error = new TeamServiceError('team_not_found');
      set({ errorKey: errorKey(error) });
      throw error;
    }

    set({ isLocking: true, errorKey: null });
    try {
      const updatedSnapshot = await teamService.lockTeam({ ...context, teamId: selectedTeamId });
      set({ snapshot: updatedSnapshot, selectedTeamId: updatedSnapshot.myTeamId, status: 'ready' });
      return updatedSnapshot;
    } catch (error) {
      set({ errorKey: errorKey(error) });
      throw error;
    } finally {
      set({ isLocking: false });
    }
  },

  reset() {
    loadSequence += 1;
    set({
      sessionHash: null,
      userId: null,
      snapshot: null,
      selectedTeamId: null,
      status: 'idle',
      isLocking: false,
      errorKey: null,
    });
  },
}));
