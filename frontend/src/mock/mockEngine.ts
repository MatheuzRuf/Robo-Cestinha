import type { Frame, PlayerState } from '../types/game';
import { COURT_WIDTH_FT, COURT_HEIGHT_FT } from '../config/court';

const BALL_OFFSET_FT = 2.5;
const PASS_CHANCE_PER_TICK = 0.15;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomStep(current: number, min: number, max: number, maxDelta = 4) {
  const delta = (Math.random() - 0.5) * 2 * maxDelta;
  return clamp(current + delta, min, max);
}

function createInitialPlayers(): PlayerState[] {
  const homeRoster = [
    ['Miller', 7, 'PG'],
    ['Walker', 33, 'PF'],
    ['King', 55, 'C'],
    ['Wash', 24, 'SF'],
    ['Johnson', 11, 'PF'],
  ] as const;
  const awayRoster = [
    ['Dinwiddie', 8, 'PG'],
    ['Bridges', 1, 'SG'],
    ['Claxton', 33, 'C'],
    ['Finney', 10, 'SF'],
    ['Vance', 4, 'SG'],
  ] as const;

  return [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `home-${i}`,
      team: 'home' as const,
      name: homeRoster[i][0],
      number: homeRoster[i][1],
      position: homeRoster[i][2],
      x: 20 + i * 10,
      y: 10 + i * 8,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `away-${i}`,
      team: 'away' as const,
      name: awayRoster[i][0],
      number: awayRoster[i][1],
      position: awayRoster[i][2],
      x: 60 + i * 10,
      y: 10 + i * 8,
    })),
  ];
}

function ballPositionFor(owner: PlayerState) {
  return { x: owner.x + BALL_OFFSET_FT, y: owner.y };
}

export function startMockEngine(onFrame: (frame: Frame) => void, intervalMs = 800) {
  let players = createInitialPlayers();
  let ownerId = players[0].id;

  const emit = () => {
    const owner = players.find((p) => p.id === ownerId)!;
    onFrame({ players, ball: ballPositionFor(owner) });
  };

  emit();

  const id = setInterval(() => {
    players = players.map((p) => ({
      ...p,
      x: randomStep(p.x, 0, COURT_WIDTH_FT),
      y: randomStep(p.y, 0, COURT_HEIGHT_FT),
    }));

    if (Math.random() < PASS_CHANCE_PER_TICK) {
      const candidates = players.filter((p) => p.id !== ownerId);
      ownerId = candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    emit();
  }, intervalMs);

  return () => clearInterval(id);
}
