export type ClubStatus = 'available' | 'locked_by_you' | 'locked_by_other';

export type RatingCategory = 'perimeter' | 'interior_defense' | 'transition' | 'rebounding';

export type PaletteTone = 'bg' | 'surface' | 'text' | 'primary' | 'warning';

export interface Player {
  id: string;
  position: string;
  name: string;
  overall: number;
  archetypeKey: string;
  badge: string;
}

export interface TeamRating {
  category: RatingCategory;
  value: number;
  rank: number;
}

export interface Club {
  id: string;
  seed: number;
  nameKey: string;
  locationKey: string;
  conferenceKey: string;
  mottoKey: string;
  arenaKey: string;
  status: ClubStatus;
  lockedBy?: string;
  palette: PaletteTone[];
  ratings: TeamRating[];
  players: Player[];
}

export interface TeamLockerData {
  sessionCode: string;
  onlineCount: { current: number; total: number };
  teams: Club[];
  myTeamId: string | null;
  initialSelectedTeamId: string | null;
}
