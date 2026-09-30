export interface SessionSettings {
  simSpeed: 'normal' | 'blitz';
  quarterLength: '3' | '5';
  autoFill: boolean;
}

export interface SessionDescriptor {
  sessionHash: string;
  sessionName?: string;
}

export interface SessionMembership extends SessionDescriptor {
  userId: string;
  userName: string;
  teamId: string | null;
  lastVisitedAt: string;
  settings?: SessionSettings;
}

export interface SessionIdentity {
  userId: string;
  userName: string;
}
