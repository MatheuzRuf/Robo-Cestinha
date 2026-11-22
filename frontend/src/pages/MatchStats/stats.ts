import type { SimulationFrame, SimulationPlayer, SimulationResponse } from '../../types/matchBroadcast';

export interface TeamMatchStats {
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  passesCompleted: number;
  passesIntercepted: number;
  turnovers: number;
  fouls: number;
  rebounds: number;
  possessionSteps: number;
  possessionShare: number;
}

export interface PlayerMatchStats {
  player: SimulationPlayer;
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  passesCompleted: number;
  passesIntercepted: number;
  turnovers: number;
  fouls: number;
}

export interface MatchStatsSummary {
  teams: Record<string, TeamMatchStats>;
  players: PlayerMatchStats[];
}

interface MutableStatLine {
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  passesCompleted: number;
  passesIntercepted: number;
  turnovers: number;
  fouls: number;
  rebounds: number;
  points: number;
}

function emptyLine(): MutableStatLine {
  return {
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    passesCompleted: 0,
    passesIntercepted: 0,
    turnovers: 0,
    fouls: 0,
    rebounds: 0,
    points: 0,
  };
}

function shotKey(iteration: number, teamId: string | null, playerId: string | null) {
  return `${iteration}:${teamId ?? ''}:${playerId ?? ''}`;
}

export function deriveMatchStats(simulation: SimulationResponse): MatchStatsSummary {
  const teamIds = [simulation.teams.home.teamId, simulation.teams.away.teamId];
  const teamLines = new Map(teamIds.map((teamId) => [teamId, emptyLine()]));
  const playerLines = new Map(simulation.players.map((player) => [player.playerId, emptyLine()]));
  const shotValues = new Map<string, number>();

  for (const event of simulation.events) {
    const teamLine = event.teamId ? teamLines.get(event.teamId) : undefined;
    const playerLine = event.playerId ? playerLines.get(event.playerId) : undefined;

    if (event.type === 'shot_attempted') {
      const shotValue = Number(event.data.shotValue);
      if (Number.isFinite(shotValue)) {
        shotValues.set(shotKey(event.iteration, event.teamId, event.playerId), shotValue);
        if (shotValue === 3) {
          if (teamLine) teamLine.threePointersAttempted += 1;
          if (playerLine) playerLine.threePointersAttempted += 1;
        }
      }
      if (teamLine) teamLine.fieldGoalsAttempted += 1;
      if (playerLine) playerLine.fieldGoalsAttempted += 1;
    } else if (event.type === 'shot_made') {
      const shotValue = shotValues.get(shotKey(event.iteration, event.teamId, event.playerId));
      const points = Number(event.data.pointsScored);
      if (teamLine) {
        teamLine.fieldGoalsMade += 1;
        teamLine.points += Number.isFinite(points) ? points : (shotValue ?? 2);
        if (shotValue === 3) teamLine.threePointersMade += 1;
      }
      if (playerLine) {
        playerLine.fieldGoalsMade += 1;
        playerLine.points += Number.isFinite(points) ? points : (shotValue ?? 2);
        if (shotValue === 3) playerLine.threePointersMade += 1;
      }
    } else if (event.type === 'pass_completed') {
      if (teamLine) teamLine.passesCompleted += 1;
      if (playerLine) playerLine.passesCompleted += 1;
    } else if (event.type === 'pass_intercepted') {
      if (teamLine) teamLine.passesIntercepted += 1;
      if (playerLine) playerLine.passesIntercepted += 1;
    } else if (event.type === 'turnover') {
      if (teamLine) teamLine.turnovers += 1;
      if (playerLine) playerLine.turnovers += 1;
    } else if (event.type === 'foul') {
      if (teamLine) teamLine.fouls += 1;
      if (playerLine) playerLine.fouls += 1;
    } else if (event.type === 'rebound' && teamLine) {
      teamLine.rebounds += 1;
    }
  }

  const possessionSteps = new Map(teamIds.map((teamId) => [teamId, 0]));
  for (const frame of simulation.frames) {
    if (frame.possessionTeamId) {
      possessionSteps.set(frame.possessionTeamId, (possessionSteps.get(frame.possessionTeamId) ?? 0) + 1);
    }
  }
  const totalPossessionSteps = [...possessionSteps.values()].reduce((sum, count) => sum + count, 0);

  const teams = Object.fromEntries(
    teamIds.map((teamId) => {
      const line = teamLines.get(teamId) ?? emptyLine();
      const points =
        teamId === simulation.teams.home.teamId ? simulation.summary.homeScore : simulation.summary.awayScore;
      const steps = possessionSteps.get(teamId) ?? 0;
      return [
        teamId,
        {
          points,
          fieldGoalsMade: line.fieldGoalsMade,
          fieldGoalsAttempted: line.fieldGoalsAttempted,
          threePointersMade: line.threePointersMade,
          threePointersAttempted: line.threePointersAttempted,
          passesCompleted: line.passesCompleted,
          passesIntercepted: line.passesIntercepted,
          turnovers: line.turnovers,
          fouls: line.fouls,
          rebounds: line.rebounds,
          possessionSteps: steps,
          possessionShare: totalPossessionSteps ? (steps / totalPossessionSteps) * 100 : 0,
        },
      ];
    }),
  ) as Record<string, TeamMatchStats>;

  const playedPlayerIds = new Set(simulation.frames.flatMap((frame) => frame.players.map((player) => player.playerId)));
  const players = simulation.players
    .filter((player) => playedPlayerIds.has(player.playerId))
    .map((player) => {
      const line = playerLines.get(player.playerId) ?? emptyLine();
      return {
        player,
        points: line.points,
        fieldGoalsMade: line.fieldGoalsMade,
        fieldGoalsAttempted: line.fieldGoalsAttempted,
        threePointersMade: line.threePointersMade,
        threePointersAttempted: line.threePointersAttempted,
        passesCompleted: line.passesCompleted,
        passesIntercepted: line.passesIntercepted,
        turnovers: line.turnovers,
        fouls: line.fouls,
      };
    })
    .sort((left, right) => right.points - left.points || left.player.name.localeCompare(right.player.name));

  return { teams, players };
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
  count: number;
}

export interface LeadMarginSegment {
  side: 'home' | 'away' | 'tied';
  points: string;
}

export interface ScoringRun {
  side: 'home' | 'away';
  points: number;
  startFrame: number;
  endFrame: number;
}

export interface LeadMarginSummary {
  segments: LeadMarginSegment[];
  scoringRuns: ScoringRun[];
  leadChanges: number;
  largestHomeLead: number;
  largestAwayLead: number;
}

export interface PassingLink {
  teamId: string;
  fromPlayerId: string;
  toPlayerId: string;
  count: number;
}

export interface PassingNetwork {
  players: SimulationPlayer[];
  links: PassingLink[];
}

export function buildPlayerHeatmap(frames: SimulationFrame[], playerId: string): HeatmapCell[] {
  const columns = 12;
  const rows = 7;
  const bins = new Map<string, { column: number; row: number; count: number }>();

  for (const frame of frames) {
    const position = frame.players.find((player) => player.playerId === playerId);
    if (!position) continue;

    const column = Math.min(columns - 1, Math.floor((position.x / 95) * columns));
    const row = Math.min(rows - 1, Math.floor((position.y / 51) * rows));
    const key = `${column}:${row}`;
    const bin = bins.get(key) ?? { column, row, count: 0 };
    bin.count += 1;
    bins.set(key, bin);
  }

  const highestCount = Math.max(1, ...[...bins.values()].map((bin) => bin.count));
  return [...bins.values()].map((bin) => ({
    x: ((bin.column + 0.5) / columns) * 940,
    y: ((bin.row + 0.5) / rows) * 500,
    intensity: bin.count / highestCount,
    count: bin.count,
  }));
}

export function buildScorePath(frames: SimulationFrame[], side: 'home' | 'away') {
  if (frames.length < 2) return '';

  const width = 760;
  const height = 180;
  const maxScore = Math.max(1, ...frames.map((frame) => Math.max(frame.score.home, frame.score.away)));
  const sampleCount = Math.min(frames.length, 120);
  const sampleStep = (frames.length - 1) / Math.max(1, sampleCount - 1);

  return Array.from({ length: sampleCount }, (_, index) => {
    const frameIndex = Math.round(index * sampleStep);
    const frame = frames[frameIndex];
    const x = (index / Math.max(1, sampleCount - 1)) * width;
    const y = height - (frame.score[side] / maxScore) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function buildLeadMarginSummary(frames: SimulationFrame[]): LeadMarginSummary {
  if (frames.length === 0) {
    return { segments: [], scoringRuns: [], leadChanges: 0, largestHomeLead: 0, largestAwayLead: 0 };
  }

  const width = 760;
  const centerY = 76;
  const sampleCount = Math.min(frames.length, 120);
  const sampleStep = (frames.length - 1) / Math.max(1, sampleCount - 1);
  const maximumMargin = Math.max(1, ...frames.map((frame) => Math.abs(frame.score.home - frame.score.away)));
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const frame = frames[Math.round(index * sampleStep)];
    const margin = frame.score.home - frame.score.away;
    const x = (index / Math.max(1, sampleCount - 1)) * width;
    const y = centerY - (margin / maximumMargin) * 58;
    return {
      x,
      y,
      side: margin > 0 ? ('home' as const) : margin < 0 ? ('away' as const) : ('tied' as const),
    };
  });

  const segments: LeadMarginSegment[] = [];
  let currentSegment: { side: LeadMarginSegment['side']; points: string[] } | null = null;
  for (const [index, point] of points.entries()) {
    const previousPoint = points[index - 1];
    if (!currentSegment || currentSegment.side !== point.side) {
      if (currentSegment) {
        segments.push({ side: currentSegment.side, points: currentSegment.points.join(' ') });
      }
      currentSegment = {
        side: point.side,
        points: previousPoint ? [`${previousPoint.x.toFixed(1)},${previousPoint.y.toFixed(1)}`] : [],
      };
    }
    currentSegment.points.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`);
  }
  if (currentSegment) {
    segments.push({ side: currentSegment.side, points: currentSegment.points.join(' ') });
  }

  let leadChanges = 0;
  let previousLeader: 'home' | 'away' | null = null;
  let largestHomeLead = 0;
  let largestAwayLead = 0;
  for (const frame of frames) {
    const margin = frame.score.home - frame.score.away;
    largestHomeLead = Math.max(largestHomeLead, margin);
    largestAwayLead = Math.max(largestAwayLead, -margin);
    const leader = margin > 0 ? 'home' : margin < 0 ? 'away' : null;
    if (leader && previousLeader && leader !== previousLeader) leadChanges += 1;
    if (leader) previousLeader = leader;
  }

  const scoringRuns: ScoringRun[] = [];
  let activeRun: ScoringRun = { side: 'home', points: 0, startFrame: 0, endFrame: 0 };
  let hasActiveRun = false;

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const homePoints = current.score.home - previous.score.home;
    const awayPoints = current.score.away - previous.score.away;
    if (homePoints <= 0 && awayPoints <= 0) continue;

    const side = homePoints > 0 && awayPoints === 0 ? 'home' : awayPoints > 0 && homePoints === 0 ? 'away' : null;
    if (!side) {
      if (hasActiveRun && activeRun.points >= 6) scoringRuns.push(activeRun);
      hasActiveRun = false;
      continue;
    }

    const pointsScored = side === 'home' ? homePoints : awayPoints;
    if (hasActiveRun && activeRun.side === side) {
      activeRun.points += pointsScored;
      activeRun.endFrame = index;
    } else {
      if (hasActiveRun && activeRun.points >= 6) scoringRuns.push(activeRun);
      activeRun = { side, points: pointsScored, startFrame: index, endFrame: index };
      hasActiveRun = true;
    }
  }
  if (hasActiveRun && activeRun.points >= 6) scoringRuns.push(activeRun);

  return { segments, scoringRuns, leadChanges, largestHomeLead, largestAwayLead };
}

export function buildPassingNetwork(simulation: SimulationResponse, playedPlayers: SimulationPlayer[]): PassingNetwork {
  const playersById = new Map(playedPlayers.map((player) => [player.playerId, player]));
  const counts = new Map<string, PassingLink>();

  for (const event of simulation.events) {
    if (event.type !== 'pass_completed' || !event.playerId || !event.targetPlayerId) continue;
    const passer = playersById.get(event.playerId);
    const receiver = playersById.get(event.targetPlayerId);
    if (!passer || !receiver || passer.teamId !== receiver.teamId) continue;

    const key = `${passer.teamId}:${passer.playerId}:${receiver.playerId}`;
    const link = counts.get(key) ?? {
      teamId: passer.teamId,
      fromPlayerId: passer.playerId,
      toPlayerId: receiver.playerId,
      count: 0,
    };
    link.count += 1;
    counts.set(key, link);
  }

  const links = [...counts.values()].sort((left, right) => right.count - left.count).slice(0, 16);
  const involvedPlayerIds = new Set(links.flatMap((link) => [link.fromPlayerId, link.toPlayerId]));
  return {
    players: playedPlayers.filter((player) => involvedPlayerIds.has(player.playerId)),
    links,
  };
}
