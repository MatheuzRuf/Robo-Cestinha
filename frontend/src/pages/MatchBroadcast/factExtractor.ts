import type { SimulationEvent } from '../../types/matchBroadcast';

export type CommentaryFactKind =
  'top' | 'hot' | 'run' | 'streak' | 'cold' | 'fouls' | 'lead' | 'close' | 'blowout' | 'endgame' | 'turnovers';

export interface CommentaryFact {
  kind: CommentaryFactKind;
  text: string;
}

export interface GameStats {
  score: { home: number; away: number };
  teamIds: { home: string; away: string };
  teamNames: Record<string, string>;
  teamFouls: Record<string, number>;
  playerNames: Record<string, string>;
  playerTeamIds: Record<string, string>;
  playerPoints: Record<string, number>;
  playerFouls: Record<string, number>;
}

interface ValidEvent {
  frame: number;
  sequence: number;
  type: string;
  teamId: string;
  playerId: string;
  points: number;
}

interface RankedFact extends CommentaryFact {
  priority: number;
  magnitude: number;
  order: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((item) => finiteNumber(item) !== undefined);
}

function isGameStats(value: unknown): value is GameStats {
  if (!isRecord(value) || !isRecord(value.score) || !isRecord(value.teamIds)) return false;
  return (
    finiteNumber(value.score.home) !== undefined &&
    finiteNumber(value.score.away) !== undefined &&
    typeof value.teamIds.home === 'string' &&
    typeof value.teamIds.away === 'string' &&
    isStringRecord(value.teamNames) &&
    isNumberRecord(value.teamFouls) &&
    isStringRecord(value.playerNames) &&
    isStringRecord(value.playerTeamIds) &&
    isNumberRecord(value.playerPoints) &&
    isNumberRecord(value.playerFouls)
  );
}

function asciiPhrase(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["']/g, '');
  if (ascii.length <= 60) return ascii;
  return `${ascii.slice(0, 57).trimEnd()}...`;
}

function printableName(name: string | undefined, fallback: string): string {
  const ascii = asciiPhrase(name?.trim() || fallback);
  if (!ascii) return fallback;
  return ascii.length > 24 ? `${ascii.slice(0, 21).trimEnd()}...` : ascii;
}

export class FactExtractor {
  static readonly RECENT_WINDOW_FRAMES = 10;
  static readonly MIN_TOP_POINTS = 10;
  static readonly MIN_TOP_TEAM_SHARE = 0.25;
  static readonly MIN_HOT_POINTS = 6;
  static readonly MIN_RUN_POINTS = 6;
  static readonly MIN_STREAK_MAKES = 3;
  static readonly STREAK_ATTEMPTS = 4;
  static readonly MIN_COLD_FRAMES = 12;
  static readonly MIN_PLAYER_FOULS = 4;
  static readonly MIN_TEAM_FOULS = 5;
  static readonly MIN_LEAD_CHANGES = 3;
  static readonly MIN_TIES = 2;
  static readonly MAX_CLOSE_MARGIN = 5;
  static readonly MIN_BLOWOUT_MARGIN = 20;
  static readonly ENDGAME_PERCENT = 0.9;
  static readonly MIN_TURNOVERS = 3;
  static readonly MAX_FACTS = 6;

  private static readonly PRIORITY: Record<CommentaryFactKind, number> = {
    endgame: 0,
    lead: 1,
    run: 2,
    hot: 3,
    streak: 4,
    top: 5,
    fouls: 6,
    close: 7,
    blowout: 8,
    cold: 9,
    turnovers: 10,
  };

  extract(
    fullHistory: readonly SimulationEvent[],
    currentFrame: number,
    totalFrames: number,
    statsNow: GameStats,
  ): readonly CommentaryFact[] {
    if (
      !Array.isArray(fullHistory) ||
      !Number.isFinite(currentFrame) ||
      !Number.isFinite(totalFrames) ||
      currentFrame < 0 ||
      totalFrames < 1 ||
      !isGameStats(statsNow)
    ) {
      return [];
    }

    const events = this.validEvents(fullHistory, currentFrame);
    const candidates: RankedFact[] = [];
    let order = 0;
    const add = (kind: CommentaryFactKind, text: string, magnitude: number) => {
      const cleanText = asciiPhrase(text);
      if (!cleanText) return;
      candidates.push({
        kind,
        text: cleanText,
        priority: FactExtractor.PRIORITY[kind],
        magnitude,
        order: order++,
      });
    };

    const windowStart = currentFrame - FactExtractor.RECENT_WINDOW_FRAMES;
    const recentEvents = events.filter((event) => event.frame > windowStart);
    const knownTeamIds = new Set(this.teamIds(statsNow));
    const scoreEvents = events.filter(
      (event) => event.type === 'shot_made' && event.points > 0 && knownTeamIds.has(event.teamId),
    );
    const scoreByTeam = this.scoreByTeam(statsNow);

    const playerTotals = Object.entries(statsNow.playerPoints)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
      .sort(
        ([firstId, firstPoints], [secondId, secondPoints]) =>
          secondPoints - firstPoints || firstId.localeCompare(secondId),
      );
    const topPlayer = playerTotals[0];
    const topPlayerQualifies =
      topPlayer &&
      (() => {
        const [playerId, points] = topPlayer;
        const teamId = statsNow.playerTeamIds[playerId];
        const teamPoints = teamId ? scoreByTeam[teamId] : undefined;
        return (
          points >= FactExtractor.MIN_TOP_POINTS &&
          teamPoints !== undefined &&
          teamPoints > 0 &&
          points / teamPoints >= FactExtractor.MIN_TOP_TEAM_SHARE
        );
      })();
    if (topPlayer && topPlayerQualifies) {
      const [playerId, points] = topPlayer;
      add('top', `${this.playerName(statsNow, playerId)}: ${points} pts (game high)`, points);
    }

    const recentPlayerPoints = new Map<string, number>();
    for (const event of recentEvents) {
      if (event.type === 'shot_made' && event.points > 0 && event.playerId && statsNow.playerNames[event.playerId]) {
        recentPlayerPoints.set(event.playerId, (recentPlayerPoints.get(event.playerId) ?? 0) + event.points);
      }
    }
    const hotPlayer = [...recentPlayerPoints.entries()].sort(
      ([firstId, firstPoints], [secondId, secondPoints]) =>
        secondPoints - firstPoints || firstId.localeCompare(secondId),
    )[0];
    if (hotPlayer && hotPlayer[1] >= FactExtractor.MIN_HOT_POINTS) {
      add('hot', `${this.playerName(statsNow, hotPlayer[0])}: ${hotPlayer[1]} pts in last 10 frames`, hotPlayer[1]);
    }

    const lastScore = scoreEvents[scoreEvents.length - 1];
    if (lastScore) {
      let unansweredPoints = 0;
      for (let index = scoreEvents.length - 1; index >= 0; index -= 1) {
        const event = scoreEvents[index];
        if (event.teamId !== lastScore.teamId) break;
        unansweredPoints += event.points;
      }
      if (unansweredPoints >= FactExtractor.MIN_RUN_POINTS) {
        add(
          'run',
          `${this.teamName(statsNow, lastScore.teamId)}: last ${unansweredPoints} points unanswered`,
          unansweredPoints,
        );
      }
    }

    const teamAttempts = this.getTeamAttempts(recentEvents);
    let bestStreak: { teamId: string; makes: number } | undefined;
    for (const [teamId, attempts] of teamAttempts) {
      if (!knownTeamIds.has(teamId)) continue;
      const lastAttempts = attempts.slice(-FactExtractor.STREAK_ATTEMPTS);
      const makes = lastAttempts.filter((attempt) => attempt.made).length;
      if (
        lastAttempts.length === FactExtractor.STREAK_ATTEMPTS &&
        makes >= FactExtractor.MIN_STREAK_MAKES &&
        (!bestStreak || makes > bestStreak.makes)
      ) {
        bestStreak = { teamId, makes };
      }
    }
    if (bestStreak) {
      add(
        'streak',
        `${this.teamName(statsNow, bestStreak.teamId)}: ${bestStreak.makes}/4 recent shots`,
        bestStreak.makes,
      );
    }

    if (currentFrame > FactExtractor.MIN_COLD_FRAMES) {
      for (const teamId of this.teamIds(statsNow)) {
        const lastTeamScore = [...scoreEvents].reverse().find((event) => event.teamId === teamId);
        const framesWithoutPoints = currentFrame - (lastTeamScore?.frame ?? 0);
        if (framesWithoutPoints >= FactExtractor.MIN_COLD_FRAMES) {
          add(
            'cold',
            `${this.teamName(statsNow, teamId)}: scoreless for ${framesWithoutPoints} frames`,
            framesWithoutPoints,
          );
        }
      }
    }

    const foulLeaders = [
      ...Object.entries(statsNow.playerFouls)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
        .map(([playerId, fouls]) => ({
          text: `${this.playerName(statsNow, playerId)}: ${fouls} fouls`,
          fouls,
          isTeam: false,
        })),
      ...Object.entries(statsNow.teamFouls)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
        .map(([teamId, fouls]) => ({
          text: `${this.teamName(statsNow, teamId)}: ${fouls} team fouls`,
          fouls,
          isTeam: true,
        })),
    ]
      .filter((item) =>
        item.isTeam ? item.fouls >= FactExtractor.MIN_TEAM_FOULS : item.fouls >= FactExtractor.MIN_PLAYER_FOULS,
      )
      .sort((first, second) => second.fouls - first.fouls || first.text.localeCompare(second.text));
    if (foulLeaders[0]) add('fouls', foulLeaders[0].text, foulLeaders[0].fouls);

    const leadFacts = this.leadMetrics(scoreEvents, windowStart, statsNow);
    if (leadFacts.changes >= FactExtractor.MIN_LEAD_CHANGES) {
      add('lead', `${leadFacts.changes} lead changes in last 10 frames`, leadFacts.changes);
    } else if (leadFacts.ties >= FactExtractor.MIN_TIES) {
      add('lead', `${leadFacts.ties} ties in last 10 frames`, leadFacts.ties);
    }

    const homeScore = finiteNumber(statsNow.score?.home);
    const awayScore = finiteNumber(statsNow.score?.away);
    if (homeScore !== undefined && awayScore !== undefined) {
      const margin = Math.abs(homeScore - awayScore);
      const leaderId =
        homeScore === awayScore ? '' : homeScore > awayScore ? statsNow.teamIds.home : statsNow.teamIds.away;
      if (margin <= FactExtractor.MAX_CLOSE_MARGIN && currentFrame / totalFrames >= 0.5) {
        add('close', `Game within ${margin} points`, -margin);
      }
      if (margin >= FactExtractor.MIN_BLOWOUT_MARGIN) {
        add('blowout', `${this.teamName(statsNow, leaderId)} leads by ${margin}`, margin);
      }
    }

    if (currentFrame / totalFrames >= FactExtractor.ENDGAME_PERCENT) {
      add('endgame', `Endgame: frame ${currentFrame}/${totalFrames}`, currentFrame / totalFrames);
    }

    const turnoversByTeam = new Map<string, number>();
    for (const event of recentEvents) {
      if (event.type === 'turnover' && knownTeamIds.has(event.teamId)) {
        turnoversByTeam.set(event.teamId, (turnoversByTeam.get(event.teamId) ?? 0) + 1);
      }
    }
    const turnoverLeader = [...turnoversByTeam.entries()].sort(
      ([firstId, firstCount], [secondId, secondCount]) => secondCount - firstCount || firstId.localeCompare(secondId),
    )[0];
    if (turnoverLeader && turnoverLeader[1] >= FactExtractor.MIN_TURNOVERS) {
      add(
        'turnovers',
        `${this.teamName(statsNow, turnoverLeader[0])}: ${turnoverLeader[1]} turnovers in last 10 frames`,
        turnoverLeader[1],
      );
    }

    return candidates
      .sort(
        (first, second) =>
          first.priority - second.priority || second.magnitude - first.magnitude || first.order - second.order,
      )
      .slice(0, FactExtractor.MAX_FACTS)
      .map(({ kind, text }) => ({ kind, text }));
  }

  private validEvents(history: readonly SimulationEvent[], currentFrame: number): ValidEvent[] {
    const events: ValidEvent[] = [];
    for (const rawEvent of history) {
      if (!isRecord(rawEvent)) continue;
      const frame = finiteNumber(rawEvent.iteration);
      const sequence = finiteNumber(rawEvent.sequence);
      const type = rawEvent.type;
      const data = isRecord(rawEvent.data) ? rawEvent.data : {};
      if (
        frame === undefined ||
        frame < 0 ||
        frame > currentFrame ||
        sequence === undefined ||
        typeof type !== 'string'
      ) {
        continue;
      }
      const points = finiteNumber(data.pointsScored) ?? 0;
      const teamId = typeof rawEvent.teamId === 'string' ? rawEvent.teamId : '';
      if (
        (type === 'shot_made' && (!teamId || points <= 0)) ||
        ((type === 'shot_attempted' || type === 'turnover') && !teamId)
      ) {
        continue;
      }
      events.push({
        frame,
        sequence,
        type,
        teamId,
        playerId: typeof rawEvent.playerId === 'string' ? rawEvent.playerId : '',
        points,
      });
    }
    return events.sort((first, second) => first.frame - second.frame || first.sequence - second.sequence);
  }

  private getTeamAttempts(events: readonly ValidEvent[]): Map<string, { made: boolean }[]> {
    const attempts = new Map<string, { made: boolean }[]>();
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (event.type !== 'shot_attempted' || !event.teamId) continue;
      const teamAttempts = attempts.get(event.teamId) ?? [];
      const result = events[index + 1];
      teamAttempts.push({
        made:
          result?.type === 'shot_made' &&
          result.frame === event.frame &&
          result.teamId === event.teamId &&
          result.playerId === event.playerId,
      });
      attempts.set(event.teamId, teamAttempts);
    }
    return attempts;
  }

  private leadMetrics(
    scoreEvents: readonly ValidEvent[],
    windowStart: number,
    stats: GameStats,
  ): { changes: number; ties: number } {
    const { home, away } = stats.teamIds;
    if (!home || !away) return { changes: 0, ties: 0 };
    const runningScore: Record<string, number> = { [home]: 0, [away]: 0 };
    let previousLeader = '';
    let previousMargin = 0;
    let changes = 0;
    let ties = 0;
    for (const event of scoreEvents) {
      if (event.teamId !== home && event.teamId !== away) continue;
      runningScore[event.teamId] += event.points;
      const margin = runningScore[home] - runningScore[away];
      if (event.frame > windowStart) {
        const leader = margin === 0 ? '' : margin > 0 ? home : away;
        if (margin === 0 && previousMargin !== 0) ties += 1;
        if (leader && previousLeader && leader !== previousLeader) changes += 1;
        if (leader) previousLeader = leader;
      } else {
        previousLeader = margin === 0 ? '' : margin > 0 ? home : away;
      }
      previousMargin = margin;
    }
    return { changes, ties };
  }

  private scoreByTeam(stats: GameStats): Record<string, number> {
    return {
      [stats.teamIds.home]: stats.score.home,
      [stats.teamIds.away]: stats.score.away,
    };
  }

  private teamIds(stats: GameStats): string[] {
    return [stats.teamIds.home, stats.teamIds.away].filter(Boolean);
  }

  private teamName(stats: GameStats, teamId: string): string {
    return printableName(stats.teamNames[teamId], teamId || 'Team');
  }

  private playerName(stats: GameStats, playerId: string): string {
    return printableName(stats.playerNames[playerId], 'Player');
  }
}
