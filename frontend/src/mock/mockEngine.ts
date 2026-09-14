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
  return [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `home-${i}`,
      team: 'home' as const,
      x: 20 + i * 10,
      y: 10 + i * 8,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `away-${i}`,
      team: 'away' as const,
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