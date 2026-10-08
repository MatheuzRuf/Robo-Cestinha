export type SessionHash = string;

export interface SessionDescriptor {
  sessionHash: string;
  sessionName?: string;
}

export interface SessionMembership extends SessionDescriptor {
  userId: string;
  userName: string;
  teamId: string | null;
  lastVisitedAt: string;
}

export interface SessionIdentity {
  userId: string;
  userName: string;
}
