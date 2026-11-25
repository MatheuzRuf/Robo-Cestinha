import type { SimulationFrame, SimulationPlayer, SimulationResponse, SimulationTeam } from '../../types/matchBroadcast';

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
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  finalStamina: number | null;
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
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
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
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
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

  const creditedSteals = new Set<string>();

  for (const event of simulation.events) {
    const teamLine = event.teamId ? teamLines.get(event.teamId) : undefined;
    const playerLine = event.playerId ? playerLines.get(event.playerId) : undefined;
    const assistedLine = event.targetPlayerId ? playerLines.get(event.targetPlayerId) : undefined;

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
      if (playerLine) {
        playerLine.rebounds += 1;
        if (event.data.reboundType === 'offensive') {
          playerLine.offensiveRebounds += 1;
        } else {
          playerLine.defensiveRebounds += 1;
        }
      }
    }

    if (event.type === 'shot_made' && assistedLine && event.targetPlayerId !== event.playerId) {
      assistedLine.assists += 1;
    }

    if ((event.type === 'turnover' || event.type === 'pass_intercepted') && event.targetPlayerId) {
      const stealKey = `${event.iteration}:${event.targetPlayerId}`;
      if (!creditedSteals.has(stealKey)) {
        creditedSteals.add(stealKey);
        const defenderLine = playerLines.get(event.targetPlayerId);
        if (defenderLine) defenderLine.steals += 1;
      }
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
  const finalFrame = simulation.frames.at(-1);
  const finalStaminaById = new Map(
    (finalFrame?.players ?? []).map((position) => [position.playerId, position.stamina ?? null]),
  );
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
        rebounds: line.rebounds,
        offensiveRebounds: line.offensiveRebounds,
        defensiveRebounds: line.defensiveRebounds,
        assists: line.assists,
        steals: line.steals,
        finalStamina: finalStaminaById.get(player.playerId) ?? null,
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

export type TrophyId = 'mvp' | 'top_scorer' | 'sharpshooter' | 'playmaker' | 'glass_cleaner' | 'defensive_anchor';

export type TrophyTier = 'gold' | 'silver' | 'bronze';

export interface MatchTrophy {
  id: TrophyId;
  tier: TrophyTier;
  player: SimulationPlayer;
  team: SimulationTeam;
  headlineValue: string;
  supportingStats: string[];
  score: number;
}

function fieldGoalPct(row: PlayerMatchStats): number {
  return row.fieldGoalsAttempted > 0 ? row.fieldGoalsMade / row.fieldGoalsAttempted : 0;
}

function threePointPct(row: PlayerMatchStats): number {
  return row.threePointersAttempted > 0 ? row.threePointersMade / row.threePointersAttempted : 0;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gameScore(row: PlayerMatchStats): number {
  return (
    row.points +
    row.rebounds * 1.2 +
    row.assists * 1.5 +
    row.steals * 2 +
    row.passesCompleted * 0.1 -
    row.turnovers * 1.5 -
    (row.fieldGoalsAttempted - row.fieldGoalsMade) * 0.4
  );
}

function supportingStats(row: PlayerMatchStats): string[] {
  const parts = [`${row.rebounds} REB`, `${row.assists} AST`, `${row.steals} STL`];
  if (row.fieldGoalsAttempted > 0) parts.push(`${formatPct(fieldGoalPct(row))} FG`);
  return parts;
}

/**
 * Compute the deterministic set of post-match awards.
 *
 * All awards degrade gracefully on legacy stored simulations that predate
 * rebounds/assists/steals tracking: an award is simply omitted when no player
 * qualifies.
 */
export function deriveMatchTrophies(simulation: SimulationResponse, stats: MatchStatsSummary): MatchTrophy[] {
  const winnerTeamId = simulation.summary.winnerTeamId;
  const teamFor = (player: SimulationPlayer): SimulationTeam =>
    player.side === 'home' ? simulation.teams.home : simulation.teams.away;
  const isWinner = (row: PlayerMatchStats) => row.player.teamId === winnerTeamId;
  const winnerFirst = (a: PlayerMatchStats, b: PlayerMatchStats) => Number(isWinner(b)) - Number(isWinner(a));
  const byName = (a: PlayerMatchStats, b: PlayerMatchStats) => a.player.name.localeCompare(b.player.name);

  const pick = (
    candidates: PlayerMatchStats[],
    compare: (a: PlayerMatchStats, b: PlayerMatchStats) => number,
  ): PlayerMatchStats | null => {
    if (!candidates.length) return null;
    return [...candidates].sort(compare)[0] ?? null;
  };

  const trophies: MatchTrophy[] = [];

  const mvp = pick(
    stats.players.filter((row) => row.points > 0 || row.rebounds > 0 || row.assists > 0),
    (a, b) =>
      gameScore(b) - gameScore(a) ||
      winnerFirst(a, b) ||
      b.points - a.points ||
      b.fieldGoalsMade - a.fieldGoalsMade ||
      byName(a, b),
  );
  if (mvp) {
    trophies.push({
      id: 'mvp',
      tier: 'gold',
      player: mvp.player,
      team: teamFor(mvp.player),
      headlineValue: `${mvp.points} PTS`,
      supportingStats: supportingStats(mvp),
      score: gameScore(mvp),
    });
  }

  const topScorer = pick(
    stats.players.filter((row) => row.points >= 1),
    (a, b) =>
      b.points - a.points ||
      fieldGoalPct(b) - fieldGoalPct(a) ||
      a.fieldGoalsAttempted - b.fieldGoalsAttempted ||
      winnerFirst(a, b) ||
      byName(a, b),
  );
  if (topScorer) {
    trophies.push({
      id: 'top_scorer',
      tier: 'silver',
      player: topScorer.player,
      team: teamFor(topScorer.player),
      headlineValue: `${topScorer.points} PTS`,
      supportingStats: supportingStats(topScorer),
      score: topScorer.points,
    });
  }

  const threePointLeaders = stats.players.filter((row) => row.threePointersMade >= 1);
  if (threePointLeaders.length) {
    const sharpshooter = pick(
      threePointLeaders,
      (a, b) =>
        b.threePointersMade - a.threePointersMade ||
        threePointPct(b) - threePointPct(a) ||
        b.points - a.points ||
        byName(a, b),
    );
    if (sharpshooter) {
      trophies.push({
        id: 'sharpshooter',
        tier: 'bronze',
        player: sharpshooter.player,
        team: teamFor(sharpshooter.player),
        headlineValue: `${sharpshooter.threePointersMade} 3PM`,
        supportingStats: [
          `${formatPct(threePointPct(sharpshooter))} 3PT`,
          `${sharpshooter.threePointersMade}/${sharpshooter.threePointersAttempted}`,
          ...supportingStats(sharpshooter).slice(0, 2),
        ],
        score: sharpshooter.threePointersMade,
      });
    }
  } else {
    const fallback = pick(
      stats.players.filter((row) => row.fieldGoalsAttempted >= 3),
      (a, b) => fieldGoalPct(b) - fieldGoalPct(a) || b.fieldGoalsMade - a.fieldGoalsMade || byName(a, b),
    );
    if (fallback) {
      trophies.push({
        id: 'sharpshooter',
        tier: 'bronze',
        player: fallback.player,
        team: teamFor(fallback.player),
        headlineValue: `${formatPct(fieldGoalPct(fallback))} FG`,
        supportingStats: [
          `${fallback.fieldGoalsMade}/${fallback.fieldGoalsAttempted}`,
          ...supportingStats(fallback).slice(0, 2),
        ],
        score: fieldGoalPct(fallback),
      });
    }
  }

  const assistLeaders = stats.players.filter((row) => row.assists >= 1);
  if (assistLeaders.length) {
    const playmaker = pick(
      assistLeaders,
      (a, b) =>
        b.assists - a.assists || b.passesCompleted - a.passesCompleted || a.turnovers - b.turnovers || byName(a, b),
    );
    if (playmaker) {
      trophies.push({
        id: 'playmaker',
        tier: 'silver',
        player: playmaker.player,
        team: teamFor(playmaker.player),
        headlineValue: `${playmaker.assists} AST`,
        supportingStats: [`${playmaker.passesCompleted} PASS`, ...supportingStats(playmaker).slice(0, 2)],
        score: playmaker.assists,
      });
    }
  } else {
    const fallback = pick(
      stats.players.filter((row) => row.passesCompleted >= 3),
      (a, b) => b.passesCompleted - a.passesCompleted || a.turnovers - b.turnovers || byName(a, b),
    );
    if (fallback) {
      trophies.push({
        id: 'playmaker',
        tier: 'silver',
        player: fallback.player,
        team: teamFor(fallback.player),
        headlineValue: `${fallback.passesCompleted} PASS`,
        supportingStats: supportingStats(fallback),
        score: fallback.passesCompleted,
      });
    }
  }

  const rebounder = pick(
    stats.players.filter((row) => row.rebounds >= 1),
    (a, b) => b.rebounds - a.rebounds || b.offensiveRebounds - a.offensiveRebounds || winnerFirst(a, b) || byName(a, b),
  );
  if (rebounder) {
    trophies.push({
      id: 'glass_cleaner',
      tier: 'bronze',
      player: rebounder.player,
      team: teamFor(rebounder.player),
      headlineValue: `${rebounder.rebounds} REB`,
      supportingStats: [`${rebounder.offensiveRebounds} OREB`, ...supportingStats(rebounder).slice(1, 3)],
      score: rebounder.rebounds,
    });
  }

  const defender = pick(
    stats.players.filter((row) => row.steals >= 1),
    (a, b) => b.steals - a.steals || a.fouls - b.fouls || winnerFirst(a, b) || byName(a, b),
  );
  if (defender) {
    trophies.push({
      id: 'defensive_anchor',
      tier: 'bronze',
      player: defender.player,
      team: teamFor(defender.player),
      headlineValue: `${defender.steals} STL`,
      supportingStats: supportingStats(defender),
      score: defender.steals,
    });
  }

  return trophies;
}
