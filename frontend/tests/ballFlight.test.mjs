import assert from 'node:assert/strict';
import test from 'node:test';
import { LEFT_HOOP_FT, RIGHT_HOOP_FT } from '../src/config/court.ts';
import {
  REBOUND_CATCH_HOLD_MS,
  REBOUND_FRAME_MAX_MS,
  REBOUND_LEG_MIN_MS,
  SHOT_LEG_MIN_MS,
  computeBallFlightPlan,
  normalizeShotTarget,
  renderedBallPosition,
} from '../src/pages/MatchBroadcast/hooks/ballFlight.ts';

function player(id, team, x, y) {
  return { id, team, x, y, name: id, position: 'PG' };
}

function makeFrame({ players = [], ball, trajectory, phase } = {}) {
  return { players, ball, trajectory, phase };
}

test('snaps baseline edge shot coordinates to the exact drawn hoop centers', () => {
  assert.deepEqual(normalizeShotTarget({ x: 0, y: 25 }), LEFT_HOOP_FT);
  assert.deepEqual(normalizeShotTarget({ x: 94, y: 25 }), RIGHT_HOOP_FT);

  const rightShot = makeFrame({
    ball: { x: 73, y: 25, isHeld: false, holderId: 'r1' },
    trajectory: {
      type: 'shot',
      from: { x: 63, y: 12 },
      to: { x: 94, y: 25 },
      fromTeam: 'home',
      toTeam: 'home',
    },
  });
  const leftShot = makeFrame({
    ball: { x: 21, y: 25, isHeld: false, holderId: 'r2' },
    trajectory: {
      type: 'shot',
      from: { x: 31, y: 38 },
      to: { x: 0, y: 25 },
      fromTeam: 'away',
      toTeam: 'away',
    },
  });

  assert.deepEqual(renderedBallPosition(rightShot), RIGHT_HOOP_FT);
  assert.deepEqual(renderedBallPosition(leftShot), LEFT_HOOP_FT);
});

test('keeps close-range under-basket shots arcing cleanly into the hoop', () => {
  const previous = makeFrame({
    players: [player('s1', 'home', 94, 25)],
    ball: { x: 94, y: 25, isHeld: true, holderId: 's1' },
  });
  const current = makeFrame({
    players: [player('s1', 'home', 94, 25)],
    ball: { x: 84, y: 25, isHeld: false, holderId: 'r1' },
    trajectory: {
      type: 'shot',
      from: { x: 94, y: 25 },
      to: { x: 94, y: 25 },
      fromTeam: 'home',
      toTeam: 'home',
    },
  });

  const plan = computeBallFlightPlan(previous, current);
  assert.deepEqual({ x: plan.points.at(-1).x, y: plan.points.at(-1).y }, RIGHT_HOOP_FT);
  assert.equal(plan.points[0].held, true);
  assert.equal(plan.points.at(-1).held, false);
  assert.ok(plan.points.some((point) => point.z >= 6));
  assert.ok(plan.durationMs >= SHOT_LEG_MIN_MS);
});

test('gives short stationary rebounds a parabolic bounce off the drawn rim and readable duration', () => {
  const missedShot = makeFrame({
    players: [player('r1', 'away', 84, 25)],
    ball: { x: 84, y: 25, isHeld: false, holderId: 'r1' },
    trajectory: {
      type: 'shot',
      from: { x: 63, y: 25 },
      to: { x: 94, y: 25 },
      fromTeam: 'home',
      toTeam: 'home',
    },
  });
  const reboundHold = makeFrame({
    players: [player('r1', 'away', 84, 25)],
    ball: { x: 84, y: 25, isHeld: true, holderId: 'r1' },
  });

  const plan = computeBallFlightPlan(missedShot, reboundHold);
  assert.deepEqual({ x: plan.points[0].x, y: plan.points[0].y }, RIGHT_HOOP_FT);
  assert.deepEqual({ x: plan.points.at(-1).x, y: plan.points.at(-1).y }, { x: 84, y: 25 });
  assert.ok(plan.points.some((point) => point.z >= 3));
  assert.ok(plan.durationMs >= REBOUND_LEG_MIN_MS);
  assert.equal(plan.hasArc, true);
  assert.ok(plan.reboundCatch);
});

test('preserves readable rebound timing and catch dwell even before a long outlet pass', () => {
  const missedShot = makeFrame({
    players: [player('r1', 'away', 80, 25), player('t1', 'away', 20, 25)],
    ball: { x: 80, y: 25, isHeld: false, holderId: 'r1' },
    trajectory: {
      type: 'shot',
      from: { x: 63, y: 12 },
      to: { x: 94, y: 25 },
      fromTeam: 'home',
      toTeam: 'home',
    },
  });
  const outletPass = makeFrame({
    players: [player('r1', 'away', 73, 25), player('t1', 'away', 20, 25)],
    ball: { x: 20, y: 25, isHeld: false, holderId: 't1' },
    trajectory: {
      type: 'pass',
      from: { x: 80, y: 25 },
      to: { x: 20, y: 25 },
      fromTeam: 'away',
      toTeam: 'away',
    },
  });

  const plan = computeBallFlightPlan(missedShot, outletPass);
  assert.ok(plan.reboundCatch);
  assert.ok(plan.durationMs > 1600 && plan.durationMs <= REBOUND_FRAME_MAX_MS);

  const reboundLegMs = plan.reboundCatch.timeFraction * plan.durationMs;
  const catchHoldMs = (plan.reboundCatch.moveDelayFraction - plan.reboundCatch.timeFraction) * plan.durationMs;
  assert.ok(
    reboundLegMs >= REBOUND_LEG_MIN_MS - 1,
    `expected rebound leg >= ${REBOUND_LEG_MIN_MS}ms, got ${reboundLegMs}`,
  );
  assert.ok(
    catchHoldMs >= REBOUND_CATCH_HOLD_MS - 10,
    `expected catch dwell >= ${REBOUND_CATCH_HOLD_MS}ms, got ${catchHoldMs}`,
  );

  // Keyframe times must start at 0, end at 1, and increase monotonically.
  assert.equal(plan.times[0], 0);
  assert.equal(plan.times.at(-1), 1);
  assert.equal(plan.times.length, plan.points.length);
  for (let index = 1; index < plan.times.length; index += 1) {
    assert.ok(plan.times[index] > plan.times[index - 1]);
  }
});

test('does not treat kickoff reset after a made basket as a rebound', () => {
  const madeShot = makeFrame({
    players: [player('s1', 'home', 73, 25)],
    ball: { x: 84, y: 25, isHeld: false, holderId: 'a1' },
    trajectory: {
      type: 'shot',
      from: { x: 73, y: 25 },
      to: { x: 94, y: 25 },
      fromTeam: 'home',
      toTeam: 'home',
    },
  });
  const kickoff = makeFrame({
    players: [player('s1', 'home', 42, 25)],
    ball: { x: 84, y: 25, isHeld: true, holderId: 'a1' },
    phase: 'kickoff',
  });

  const plan = computeBallFlightPlan(madeShot, kickoff);
  assert.equal(plan.reboundCatch, null);
  assert.equal(plan.hasArc, false);
  assert.deepEqual({ x: plan.points[0].x, y: plan.points[0].y }, RIGHT_HOOP_FT);
});
