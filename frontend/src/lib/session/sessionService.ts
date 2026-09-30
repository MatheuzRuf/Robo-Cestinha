import type { SessionDescriptor, SessionMembership, SessionSettings } from './types';

export const featuredSessionCodes = ['#RC-7842-OAK', '#RC-9104-TEX'] as const;

const mockSessions: SessionDescriptor[] = featuredSessionCodes.map((sessionHash) => ({ sessionHash }));

function createMockId(prefix: string) {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function createSessionHash() {
  const cityCodes = ['OAK', 'TEX', 'CHI', 'SEA', 'BKN', 'MIA'];
  const number = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');
  const cityCode = cityCodes[Math.floor(Math.random() * cityCodes.length)];

  return `#RC-${number}-${cityCode}`;
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
  async createSession(userName: string, settings: SessionSettings): Promise<SessionMembership> {
    const sessionHash = createSessionHash();

    return {
      sessionHash,
      userId: createMockId('mock-user'),
      userName,
      teamId: null,
      lastVisitedAt: new Date().toISOString(),
      settings,
    };
  },

  async findSession(codeOrInviteUrl: string): Promise<SessionDescriptor | null> {
    const sessionHash = normalizeSessionCode(codeOrInviteUrl);
    if (!sessionHash) return null;

    return mockSessions.find((session) => session.sessionHash === sessionHash) ?? null;
  },

  async joinSession(session: SessionDescriptor, userName: string): Promise<SessionMembership> {
    return {
      ...session,
      userId: createMockId('mock-user'),
      userName,
      teamId: null,
      lastVisitedAt: new Date().toISOString(),
    };
  },
};
