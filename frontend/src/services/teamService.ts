import { ensureSessionStorageAvailable, sessionStorage as browserStorage } from '../lib/storage/sessionStorage';
import type {
  LockTeamInput,
  LockerTeam,
  PlayerAttributes,
  TeamLockerContext,
  TeamLockerSnapshot,
  TeamPlayer,
} from '../types/team';
import { TeamServiceError } from '../types/team';

const CLAIMS_STORAGE_KEY = 'robo-cestinha-team-locker-claims';
const MOCK_SESSION_TEAM_IDS = ['bkn', 'nyk', 'bos', 'gsw', 'okc', 'lal', 'den', 'phi'];

interface StoredClaims {
  [sessionHash: string]: {
    [userId: string]: string;
  };
}

let mockTeamsPromise: Promise<Omit<LockerTeam, 'claimStatus'>[]> | null = null;

function getMockTeams() {
  if (!mockTeamsPromise) {
    mockTeamsPromise = Promise.all([
      import('../../../data/processed/players.json'),
      import('../../../data/processed/teams.json'),
    ]).then(([playersModule, teamsModule]) => {
      const playerById = new Map(playersModule.default.map((player) => [player.player_id, player]));

      return MOCK_SESSION_TEAM_IDS.flatMap((teamId) => {
        const catalogTeam = teamsModule.default.find((team) => team.team_id === teamId);
        if (!catalogTeam) return [];

        const players: TeamPlayer[] = catalogTeam.roster.flatMap((playerId) => {
          const player = playerById.get(playerId);
          if (!player) return [];

          const attributes: PlayerAttributes = {
            twoPointPct: player.attributes.two_pt_pct,
            threePointPct: player.attributes.three_pt_pct,
            freeThrowPct: player.attributes.ft_pct,
            turnoverRate: player.attributes.turnover_rate,
            foulRate: player.attributes.foul_rate,
            reboundRate: player.attributes.rebound_rate,
            assistRate: player.attributes.assist_rate,
            stealRate: player.attributes.steal_rate,
            blockRate: player.attributes.block_rate,
            stamina: player.attributes.stamina,
            clutchFactor: player.attributes.clutch_factor,
            usageRate: player.attributes.usage_rate,
          };

          return [
            {
              id: player.player_id,
              name: player.name,
              position: player.position5,
              positionGroup: player.position,
              isStarter: player.is_starter,
              attributes,
            },
          ];
        });

        return [
          {
            id: catalogTeam.team_id,
            name: catalogTeam.name,
            abbreviation: catalogTeam.abbreviation,
            season: catalogTeam.season,
            statistics: {
              pace: catalogTeam.team_stats.pace,
              offensiveRating: catalogTeam.team_stats.off_rtg,
              defensiveRating: catalogTeam.team_stats.def_rtg,
            },
            players,
          },
        ];
      });
    });
  }

  return mockTeamsPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readClaims(): Promise<StoredClaims> {
  const savedValue = await browserStorage.getItem(CLAIMS_STORAGE_KEY);
  if (!savedValue) return {};

  try {
    const parsed: unknown = JSON.parse(savedValue);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([sessionHash, value]) => {
        if (!isRecord(value)) return [];

        const userClaims = Object.fromEntries(
          Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        );
        return [[sessionHash, userClaims]];
      }),
    );
  } catch {
    return {};
  }
}

async function writeClaims(claims: StoredClaims) {
  try {
    ensureSessionStorageAvailable();
    await browserStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  } catch {
    throw new TeamServiceError('storage_unavailable');
  }
}

function validateContext(context: TeamLockerContext) {
  if (!context.sessionHash.trim() || !context.userId.trim()) {
    throw new TeamServiceError('team_not_found');
  }
}

function createSnapshot(
  sessionHash: string,
  userId: string,
  claims: StoredClaims,
  mockTeams: Omit<LockerTeam, 'claimStatus'>[],
): TeamLockerSnapshot {
  const sessionClaims = claims[sessionHash] ?? {};
  const myTeamId = mockTeams.some((team) => team.id === sessionClaims[userId]) ? sessionClaims[userId] : null;
  const teamOwners = new Map(Object.entries(sessionClaims).map(([ownerId, teamId]) => [teamId, ownerId]));
  const teams = mockTeams.map((team) => {
    const ownerId = teamOwners.get(team.id);
    return {
      ...team,
      players: team.players.map((player) => ({ ...player, attributes: { ...player.attributes } })),
      claimStatus: ownerId === undefined ? 'available' : ownerId === userId ? 'locked_by_you' : 'locked_by_other',
    } satisfies LockerTeam;
  });

  return {
    sessionHash,
    teams,
    myTeamId,
    openTeamCount: teams.filter((team) => team.claimStatus === 'available').length,
    totalTeamCount: teams.length,
  };
}

export interface TeamService {
  getLocker(context: TeamLockerContext): Promise<TeamLockerSnapshot>;
  lockTeam(input: LockTeamInput): Promise<TeamLockerSnapshot>;
}

export const teamService: TeamService = {
  async getLocker(context) {
    validateContext(context);
    const [claims, mockTeams] = await Promise.all([readClaims(), getMockTeams()]);
    return createSnapshot(context.sessionHash, context.userId, claims, mockTeams);
  },

  async lockTeam(input) {
    validateContext(input);
    const [claims, mockTeams] = await Promise.all([readClaims(), getMockTeams()]);
    const sessionClaims = claims[input.sessionHash] ?? {};

    if (sessionClaims[input.userId]) throw new TeamServiceError('already_claimed');
    if (!mockTeams.some((team) => team.id === input.teamId)) throw new TeamServiceError('team_not_found');
    if (Object.values(sessionClaims).includes(input.teamId)) throw new TeamServiceError('team_unavailable');

    claims[input.sessionHash] = { ...sessionClaims, [input.userId]: input.teamId };
    await writeClaims(claims);
    return createSnapshot(input.sessionHash, input.userId, claims, mockTeams);
  },
};
