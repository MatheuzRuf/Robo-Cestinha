import { API_BASE_URL } from '../config/api';
import type {
  SessionDescriptor,
  SessionMembership,
  SessionParticipant,
  SessionValidationResult,
} from '../types/session';

interface SessionMembershipResponse {
  session_hash: string;
  user_id?: string;
  owner_user_id?: string;
  owner_name?: string;
  user_name?: string;
  session_name?: string;
  team_id: string | null;
  last_visited_at: string;
}

interface SessionDescriptorResponse {
  session_hash: string;
  session_name?: string | null;
  owner_user_id?: string | null;
}

interface SessionParticipantResponse {
  user_id: string;
  user_name: string;
  join_sequence: number;
  is_owner: boolean;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 404) throw new Error('session_not_found');
    throw new Error('session_request_failed');
  }

  return (await response.json()) as T;
}

async function readDeleteResponse(response: Response): Promise<void> {
  if (response.ok) return;

  let code = 'session_action_failed';
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === 'string') code = payload.detail;
  } catch {
    code = 'session_action_failed';
  }

  throw new Error(code);
}

export function normalizeSessionCode(input: string): string | null {
  let decoded = input.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original input if it is not a valid encoded URL fragment.
  }

  const match = decoded.toUpperCase().match(/#?RC-\d{4}-[A-Z]{3}\b/);
  if (!match) return null;

  return `#${match[0].replace(/^#/, '')}`;
}

export const sessionService = {
  async createSession(userName: string, sessionName: string): Promise<SessionMembership> {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_name: userName, session_name: sessionName }),
    });
    const payload = await readResponse<SessionMembershipResponse>(response);
    const userId = payload.owner_user_id ?? payload.user_id;
    if (!userId) throw new Error('session_response_invalid');

    return {
      sessionHash: payload.session_hash,
      sessionName: payload.session_name ?? sessionName,
      userId,
      userName: payload.owner_name ?? payload.user_name ?? userName,
      teamId: payload.team_id,
      lastVisitedAt: payload.last_visited_at,
    };
  },

  async findSession(codeOrInviteUrl: string): Promise<SessionDescriptor | null> {
    const sessionHash = normalizeSessionCode(codeOrInviteUrl);
    if (!sessionHash) return null;

    let payload: SessionDescriptorResponse;
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionHash)}`);
      payload = await readResponse<SessionDescriptorResponse>(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'session_not_found') return null;
      throw error;
    }

    return {
      sessionHash: payload.session_hash,
      ...(payload.session_name ? { sessionName: payload.session_name } : {}),
      ...(payload.owner_user_id ? { ownerUserId: payload.owner_user_id } : {}),
    };
  },

  async validateSavedSessions(
    memberships: Array<Pick<SessionMembership, 'sessionHash' | 'userId'>>,
  ): Promise<SessionValidationResult[]> {
    const checks = await Promise.all(
      memberships.map(async ({ sessionHash, userId }) => {
        try {
          const descriptor = await sessionService.findSession(sessionHash);
          if (!descriptor) return { sessionHash, userId, descriptor: null };
          const participants = await sessionService.getSessionParticipants(sessionHash);
          return {
            sessionHash,
            userId,
            descriptor: participants.some((participant) => participant.userId === userId) ? descriptor : null,
          };
        } catch (error) {
          if (error instanceof Error && error.message === 'session_not_found') {
            return { sessionHash, userId, descriptor: null };
          }
          return null;
        }
      }),
    );
    return checks.filter((check): check is SessionValidationResult => check !== null);
  },

  async joinSession(session: SessionDescriptor, userName: string): Promise<SessionMembership> {
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(session.sessionHash)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: userName }),
    });
    const payload = await readResponse<SessionMembershipResponse>(response);
    if (!payload.user_id) throw new Error('session_response_invalid');

    return {
      sessionHash: payload.session_hash,
      sessionName: payload.session_name ?? session.sessionName,
      userId: payload.user_id,
      userName: payload.user_name ?? userName,
      teamId: payload.team_id,
      lastVisitedAt: payload.last_visited_at,
    };
  },

  async deleteSession(sessionHash: string, userId: string): Promise<void> {
    const query = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionHash)}?${query}`, {
      method: 'DELETE',
    });
    await readDeleteResponse(response);
  },

  async leaveSession(sessionHash: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/sessions/${encodeURIComponent(sessionHash)}/participants/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
    await readDeleteResponse(response);
  },

  async getSessionParticipants(sessionHash: string): Promise<SessionParticipant[]> {
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionHash)}/participants`);
    const participants = await readResponse<SessionParticipantResponse[]>(response);
    return participants.map((participant) => ({
      userId: participant.user_id,
      userName: participant.user_name,
      joinSequence: participant.join_sequence,
      isOwner: participant.is_owner,
    }));
  },
};
