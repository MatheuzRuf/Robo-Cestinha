export type SessionHash = string;

export interface SessionDescriptor {
  sessionHash: string;
  sessionName?: string;
  ownerUserId?: string | null;
}

export interface SessionMembership extends SessionDescriptor {
  userId: string;
  userName: string;
  teamId: string | null;
  lastVisitedAt: string;
}

export interface SessionValidationResult {
  sessionHash: string;
  userId: string;
  descriptor: SessionDescriptor | null;
}

export interface SessionIdentity {
  userId: string;
  userName: string;
}

export interface SessionParticipant {
  userId: string;
  userName: string;
  joinSequence: number;
  isOwner: boolean;
}
