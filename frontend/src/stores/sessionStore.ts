import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ensureSessionStorageAvailable, sessionStorage } from '../lib/storage/sessionStorage';
import { sessionService, normalizeSessionCode } from '../services/sessionService';
import type { SessionDescriptor, SessionIdentity, SessionMembership, SessionSettings } from '../types/session';

const RECENT_SESSION_LIMIT = 5;

interface SessionStoreState {
  activeSessionHash: string | null;
  identitiesBySessionHash: Record<string, SessionIdentity>;
  recentSessions: SessionMembership[];
  createSession: (userName: string, settings: SessionSettings) => Promise<SessionMembership>;
  findSession: (codeOrInviteUrl: string) => Promise<SessionDescriptor | null>;
  joinSession: (session: SessionDescriptor, userName: string) => Promise<SessionMembership>;
  resumeSession: (sessionHash: string) => SessionMembership;
  getSavedMembership: (sessionHash: string) => SessionMembership | null;
  setTeamForSession: (sessionHash: string, teamId: string | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeMembership(value: unknown): SessionMembership | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.sessionHash !== 'string' ||
    typeof value.userId !== 'string' ||
    typeof value.userName !== 'string' ||
    typeof value.lastVisitedAt !== 'string'
  ) {
    return null;
  }

  const settings = isRecord(value.settings) ? value.settings : null;
  const sanitizedSettings =
    settings &&
    (settings.simSpeed === 'normal' || settings.simSpeed === 'blitz') &&
    (settings.quarterLength === '3' || settings.quarterLength === '5') &&
    typeof settings.autoFill === 'boolean'
      ? {
          simSpeed: settings.simSpeed as SessionSettings['simSpeed'],
          quarterLength: settings.quarterLength as SessionSettings['quarterLength'],
          autoFill: settings.autoFill,
        }
      : undefined;

  return {
    sessionHash: value.sessionHash,
    ...(typeof value.sessionName === 'string' ? { sessionName: value.sessionName } : {}),
    userId: value.userId,
    userName: value.userName,
    teamId: typeof value.teamId === 'string' ? value.teamId : null,
    lastVisitedAt: value.lastVisitedAt,
    ...(sanitizedSettings ? { settings: sanitizedSettings } : {}),
  };
}

function sanitizePersistedState(value: unknown) {
  if (!isRecord(value)) {
    return {
      activeSessionHash: null,
      identitiesBySessionHash: {} as Record<string, SessionIdentity>,
      recentSessions: [] as SessionMembership[],
    };
  }

  const recentSessions = Array.isArray(value.recentSessions)
    ? value.recentSessions.map(sanitizeMembership).filter((session): session is SessionMembership => session !== null)
    : [];
  const limitedRecentSessions = recentSessions.slice(0, RECENT_SESSION_LIMIT);
  const recentHashes = new Set(limitedRecentSessions.map((session) => session.sessionHash));

  const identitiesBySessionHash: Record<string, SessionIdentity> = {};
  if (isRecord(value.identitiesBySessionHash)) {
    for (const [sessionHash, identity] of Object.entries(value.identitiesBySessionHash)) {
      if (
        recentHashes.has(sessionHash) &&
        isRecord(identity) &&
        typeof identity.userId === 'string' &&
        typeof identity.userName === 'string'
      ) {
        identitiesBySessionHash[sessionHash] = { userId: identity.userId, userName: identity.userName };
      }
    }
  }

  return {
    activeSessionHash:
      typeof value.activeSessionHash === 'string' && recentHashes.has(value.activeSessionHash)
        ? value.activeSessionHash
        : null,
    identitiesBySessionHash,
    recentSessions: limitedRecentSessions,
  };
}

function upsertRecentSession(recentSessions: SessionMembership[], membership: SessionMembership) {
  return [membership, ...recentSessions.filter((session) => session.sessionHash !== membership.sessionHash)]
    .sort((left, right) => right.lastVisitedAt.localeCompare(left.lastVisitedAt))
    .slice(0, RECENT_SESSION_LIMIT);
}

function pruneIdentities(identities: Record<string, SessionIdentity>, recentSessions: SessionMembership[]) {
  const recentHashes = new Set(recentSessions.map((session) => session.sessionHash));
  return Object.fromEntries(Object.entries(identities).filter(([sessionHash]) => recentHashes.has(sessionHash)));
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      activeSessionHash: null,
      identitiesBySessionHash: {},
      recentSessions: [],

      async createSession(userName, settings) {
        ensureSessionStorageAvailable();
        const membership = await sessionService.createSession(userName, settings);
        set((state) => ({
          activeSessionHash: membership.sessionHash,
          identitiesBySessionHash: pruneIdentities(
            {
              ...state.identitiesBySessionHash,
              [membership.sessionHash]: { userId: membership.userId, userName: membership.userName },
            },
            upsertRecentSession(state.recentSessions, membership),
          ),
          recentSessions: upsertRecentSession(state.recentSessions, membership),
        }));
        return membership;
      },

      async findSession(codeOrInviteUrl) {
        const sessionHash = normalizeSessionCode(codeOrInviteUrl);
        if (!sessionHash) return null;

        const savedSession = get().recentSessions.find((session) => session.sessionHash === sessionHash);
        if (savedSession) return { sessionHash: savedSession.sessionHash, sessionName: savedSession.sessionName };

        return sessionService.findSession(sessionHash);
      },

      async joinSession(session, userName) {
        ensureSessionStorageAvailable();
        const membership = await sessionService.joinSession(session, userName);
        set((state) => ({
          activeSessionHash: membership.sessionHash,
          identitiesBySessionHash: pruneIdentities(
            {
              ...state.identitiesBySessionHash,
              [membership.sessionHash]: { userId: membership.userId, userName: membership.userName },
            },
            upsertRecentSession(state.recentSessions, membership),
          ),
          recentSessions: upsertRecentSession(state.recentSessions, membership),
        }));
        return membership;
      },

      resumeSession(sessionHash) {
        ensureSessionStorageAvailable();
        const savedSession = get().recentSessions.find((session) => session.sessionHash === sessionHash);
        const identity = get().identitiesBySessionHash[sessionHash];
        if (!savedSession || !identity) throw new Error('saved_identity_not_found');

        const membership = {
          ...savedSession,
          ...identity,
          lastVisitedAt: new Date().toISOString(),
        };

        set((state) => ({
          activeSessionHash: sessionHash,
          recentSessions: upsertRecentSession(state.recentSessions, membership),
        }));
        return membership;
      },

      getSavedMembership(sessionHash) {
        const savedSession = get().recentSessions.find((session) => session.sessionHash === sessionHash);
        const identity = get().identitiesBySessionHash[sessionHash];
        return savedSession && identity ? { ...savedSession, ...identity } : null;
      },

      setTeamForSession(sessionHash, teamId) {
        set((state) => ({
          recentSessions: state.recentSessions.map((session) =>
            session.sessionHash === sessionHash ? { ...session, teamId } : session,
          ),
        }));
      },
    }),
    {
      name: 'robo-cestinha-session-state',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState),
      }),
    },
  ),
);
