import type {
  SimulationEvent,
  SimulationFrame,
  SimulationPlayer,
  SimulationResponse,
  SimulationTeam,
} from '../../types/matchBroadcast';
import { sampleCommentaryFrames } from './commentaryFrameSampling';
import { FactExtractor, type CommentaryFact, type GameStats } from './factExtractor';

export interface CommentaryEventSnapshot {
  f: number;
  ty: string;
  p: string;
  tm: string;
  pts?: number;
  d?: string;
}

export interface CommentarySnapshot {
  f: number;
  tf: number;
  ev: CommentaryEventSnapshot[];
  st: {
    sc: { h: number; a: number };
    tf: Record<string, number>;
    pp: Record<string, number>;
    pf: Record<string, number>;
  };
  facts: readonly CommentaryFact[];
  topFact: CommentaryFact | null;
}

const eventTypeLabels: Record<string, string> = {
  shot_made: 'Score',
  foul: 'Foul',
  timeout: 'Timeout',
  turnover: 'Turnover',
  steal: 'Steal',
  pass_intercepted: 'Steal',
  block: 'Block',
  substitution: 'Substitution',
  quarter_end: 'QuarterEnd',
};

export const SIGNIFICANT_COMMENTARY_EVENTS = new Set([
  'shot_made',
  'foul',
  'timeout',
  'turnover',
  'steal',
  'pass_intercepted',
  'block',
  'substitution',
  'quarter_end',
]);

const RECENT_EVENT_WINDOW_SIZE = 40;
const factExtractor = new FactExtractor();

export const FALLBACK_COMMENTARY_LINES = [
  'The crowd is on its feet!',
  'This is getting intense!',
  'You can feel the energy in the arena!',
  'Every possession matters now!',
  'What a finish to this game!',
] as const;

function getNumericData(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildCommentarySnapshot({
  events,
  frame,
  totalFrames,
  players,
  teams,
}: {
  events: SimulationEvent[];
  frame: SimulationFrame;
  totalFrames: number;
  players: SimulationPlayer[];
  teams: { home: SimulationTeam; away: SimulationTeam };
}): CommentarySnapshot {
  const playerNameById = new Map(players.map((player) => [player.playerId, player.name]));
  const teamNameById = new Map([
    [teams.home.teamId, teams.home.abbreviation],
    [teams.away.teamId, teams.away.abbreviation],
  ]);
  const currentEvents = events.filter((event) => event.iteration <= frame.iteration);
  const recentEvents = currentEvents.slice(-RECENT_EVENT_WINDOW_SIZE).map((event) => {
    const mappedType = eventTypeLabels[event.type] ?? event.type;
    const points = getNumericData(event.data, 'pointsScored');
    return {
      f: event.iteration,
      ty: mappedType,
      p: playerNameById.get(event.playerId ?? '') ?? '',
      tm: teamNameById.get(event.teamId ?? '') ?? '',
      ...(points === undefined ? {} : { pts: points }),
    };
  });

  const teamFouls: Record<string, number> = {
    [teams.home.abbreviation]: 0,
    [teams.away.abbreviation]: 0,
  };
  const playerPoints: Record<string, number> = {};
  const playerFouls: Record<string, number> = {};
  const teamFoulsById: Record<string, number> = {};
  const playerPointsById: Record<string, number> = {};
  const playerFoulsById: Record<string, number> = {};

  for (const event of currentEvents) {
    const teamName = teamNameById.get(event.teamId ?? '');
    const teamId = event.teamId ?? '';
    const playerId = event.playerId ?? '';
    if (event.type === 'foul' && teamName) {
      teamFouls[teamName] = (teamFouls[teamName] ?? 0) + 1;
      teamFoulsById[teamId] = (teamFoulsById[teamId] ?? 0) + 1;
      if (playerId) playerFoulsById[playerId] = (playerFoulsById[playerId] ?? 0) + 1;
      const playerName = playerNameById.get(playerId);
      if (playerName) playerFouls[playerName] = (playerFouls[playerName] ?? 0) + 1;
    }

    if (event.type === 'shot_made' && event.playerId) {
      const playerName = playerNameById.get(event.playerId);
      const points = getNumericData(event.data, 'pointsScored');
      if (playerName && points !== undefined) {
        playerPoints[playerName] = (playerPoints[playerName] ?? 0) + points;
        playerPointsById[playerId] = (playerPointsById[playerId] ?? 0) + points;
      }
    }
  }

  const statsNow: GameStats = {
    score: { home: frame.score.home, away: frame.score.away },
    teamIds: { home: teams.home.teamId, away: teams.away.teamId },
    teamNames: Object.fromEntries(teamNameById),
    teamFouls: teamFoulsById,
    playerNames: Object.fromEntries(playerNameById),
    playerTeamIds: Object.fromEntries(players.map((player) => [player.playerId, player.teamId])),
    playerPoints: playerPointsById,
    playerFouls: playerFoulsById,
  };
  const facts: readonly CommentaryFact[] = factExtractor.extract(events, frame.iteration, totalFrames, statsNow);
  return {
    f: frame.iteration,
    tf: totalFrames,
    ev: recentEvents,
    st: {
      sc: { h: frame.score.home, a: frame.score.away },
      tf: teamFouls,
      pp: playerPoints,
      pf: playerFouls,
    },
    facts,
    topFact: facts[0] ?? null,
  };
}

export function buildMatchCommentarySnapshots(simulation: SimulationResponse): CommentarySnapshot[] {
  const framesByIteration = new Map(simulation.frames.map((frame) => [frame.iteration, frame]));
  const significantFrames = [
    ...new Set(
      simulation.events
        .filter((event) => SIGNIFICANT_COMMENTARY_EVENTS.has(event.type))
        .map((event) => event.iteration),
    ),
  ].sort((first, second) => first - second);
  const eventFrames = sampleCommentaryFrames(significantFrames);

  return eventFrames.flatMap((iteration) => {
    const frame = framesByIteration.get(iteration);
    if (!frame) return [];

    return [
      buildCommentarySnapshot({
        events: simulation.events,
        frame,
        totalFrames: Math.max(1, simulation.frames.length - 1),
        players: simulation.players,
        teams: simulation.teams,
      }),
    ];
  });
}
