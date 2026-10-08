import { API_BASE_URL } from '../config/api';
import type { SessionDescriptor, SessionMembership, SessionSettings } from '../types/session';

interface SessionSettingsResponse {
  sim_speed: SessionSettings['simSpeed'];
  quarter_length: SessionSettings['quarterLength'];
  auto_fill: boolean;
}

interface SessionMembershipResponse {
  session_hash: string;
  user_id?: string;
  owner_user_id?: string;
  owner_name?: string;
  user_name?: string;
  team_id: string | null;
  last_visited_at: string;
  settings?: SessionSettingsResponse | null;
}

interface SessionDescriptorResponse {
  session_hash: string;
  session_name?: string | null;
}

interface FeaturedSessionsResponse {
  session_hashes: string[];
}

function mapSettings(settings?: SessionSettingsResponse | null): SessionSettings | undefined {
  if (!settings) return undefined;
  return {
    simSpeed: settings.sim_speed,
    quarterLength: settings.quarter_length,
    autoFill: settings.auto_fill,
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 404) throw new Error('session_not_found');
    throw new Error('session_request_failed');
  }

  return (await response.json()) as T;
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
  async getFeaturedSessionCodes(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/sessions/featured`);
    const payload = await readResponse<FeaturedSessionsResponse>(response);
    return payload.session_hashes;
  },

  async createSession(userName: string, settings: SessionSettings): Promise<SessionMembership> {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_name: userName,
        settings: {
          sim_speed: settings.simSpeed,
          quarter_length: settings.quarterLength,
          auto_fill: settings.autoFill,
        },
      }),
    });
    const payload = await readResponse<SessionMembershipResponse>(response);
    const userId = payload.owner_user_id ?? payload.user_id;
    if (!userId) throw new Error('session_response_invalid');

    return {
      sessionHash: payload.session_hash,
      userId,
      userName: payload.owner_name ?? payload.user_name ?? userName,
      teamId: payload.team_id,
      lastVisitedAt: payload.last_visited_at,
      settings: mapSettings(payload.settings) ?? settings,
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
    };
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
      ...(session.sessionName ? { sessionName: session.sessionName } : {}),
      userId: payload.user_id,
      userName: payload.user_name ?? userName,
      teamId: payload.team_id,
      lastVisitedAt: payload.last_visited_at,
      settings: mapSettings(payload.settings),
    };
  },
};
