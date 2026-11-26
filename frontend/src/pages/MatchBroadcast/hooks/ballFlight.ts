import { hoopPositionFt, hoopSideFromX } from '../../../config/court.ts';
import type { Frame, PlayerState } from '../../../types/game.ts';

/** Baseline duration when no movement data is available (edge frames). */
export const TRANSITION_DURATION_MS = 800;
/** Fast but humanly plausible ball speed for passes, dribbles, and shots. */
export const BALL_SPEED_CAP_FT_S = 20;
/** Slower carom speed for rebounds bouncing off the rim to the rebounder. */
export const REBOUND_SPEED_CAP_FT_S = 13;
export const TRANSITION_DURATION_MIN_MS = 280;
export const TRANSITION_DURATION_MAX_MS = 1600;
export const SHOT_LEG_MIN_MS = 420;
export const REBOUND_LEG_MIN_MS = 480;
export const REBOUND_LEG_MAX_MS = 1050;
export const REBOUND_CATCH_HOLD_MS = 180;
export const REBOUND_FOLLOW_UP_MIN_MS = 320;
export const REBOUND_FOLLOW_UP_MAX_MS = 1150;
export const REBOUND_FRAME_MAX_MS = 2400;

export interface RenderedBall {
  x: number;
  y: number;
}

export interface FlightPathPoint {
  x: number;
  y: number;
  /** Synthetic height above the court floor in feet (0 = floor/held). */
  z: number;
  /** True when the ball rests in a player's hands (applies HELD_BALL_OFFSET). */
  held?: boolean;
}

export interface ReboundCatch {
  /** Feet position where the ball comes off the rim to the rebounder. */
  point: RenderedBall;
  /** Fraction of the frame duration at which the ball reaches the catch point. */
  timeFraction: number;
  /** Fraction of the frame duration at which the rebounder begins moving. */
  moveDelayFraction: number;
}

export interface BallFlightPlan {
  points: FlightPathPoint[];
  /** Normalized keyframe times [0..1] matching each point. */
  times: number[];
  /** Transition duration in milliseconds at 1x playback speed. */
  durationMs: number;
  /** Rebound catch timing/location metadata when this frame follows a missed shot. */
  reboundCatch: ReboundCatch | null;
  /** Parabolic arc peak (feet) when this frame contains a shot to the rim. */
  shotArcPeakFt: number | null;
  /** True when the primary motion is a parabolic shot or rebound arc. */
  hasArc: boolean;
}

const PARABOLA_SAMPLES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

export function distance(a: RenderedBall, b: RenderedBall): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playerDistance(a: PlayerState, b: PlayerState): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parabolic shot arc peak (feet) scaled by flight length. */
export function shotArcPeakFt(from: RenderedBall, to: RenderedBall): number {
  const length = distance(from, to);
  return clamp(length * 0.22, 6, 12);
}

/** Parabolic bounce lift (feet) as the ball caroms off the rim to the rebounder. */
export function reboundLiftFt(from: RenderedBall, to: RenderedBall): number {
  const length = distance(from, to);
  return clamp(length * 0.24, 3.2, 6.5);
}

/**
 * Sample a smooth parabolic arc peaking at ``liftFt`` in the middle:
 * ``z(t) = 4 * liftFt * t * (1 - t)``.
 */
function arcSamples(
  from: RenderedBall,
  to: RenderedBall,
  liftFt: number,
  startHeld: boolean,
  endHeld: boolean,
): FlightPathPoint[] {
  return PARABOLA_SAMPLES.map((t, index) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: 4 * liftFt * t * (1 - t),
    held: index === 0 ? startHeld : index === PARABOLA_SAMPLES.length - 1 ? endHeld : false,
  }));
}

/**
 * Snap a shot target to the canonical drawn hoop center in court feet
 * (5.25 ft or 88.75 ft from the left baseline at y = 25 ft) so shots and
 * rebounds align with the rendered basket rather than the court baseline edge.
 */
export function normalizeShotTarget(target: RenderedBall): RenderedBall {
  return hoopPositionFt(hoopSideFromX(target.x));
}

/**
 * Position the animated ball should render at for a frame: while a shot
 * trajectory is attached, the ball sits at the drawn hoop center instead of
 * the next holder's spot.
 */
export function renderedBallPosition(frame: Frame): RenderedBall {
  if (frame.trajectory?.type === 'shot') {
    return normalizeShotTarget(frame.trajectory.to);
  }
  return { x: frame.ball.x, y: frame.ball.y };
}

function isFrameBallHeld(frame: Frame): boolean {
  return Boolean(frame.ball.isHeld && frame.trajectory?.type !== 'shot');
}

/**
 * True when ``previous`` is a missed-shot frame whose rebound is resolved by
 * the holder captured on that frame. Made baskets are excluded because their
 * following frame is the kickoff reset (phase ``"kickoff"``).
 */
export function isReboundFrame(previous: Frame, current: Frame): boolean {
  return previous.trajectory?.type === 'shot' && current.phase !== 'kickoff';
}

function maxPlayerTravelFt(previous: Frame, current: Frame): number {
  const currentById = new Map(current.players.map((player) => [player.id, player]));
  let maxFeet = 0;
  for (const player of previous.players) {
    const nextPosition = currentById.get(player.id);
    if (nextPosition) {
      maxFeet = Math.max(maxFeet, playerDistance(player, nextPosition));
    }
  }
  return maxFeet;
}

/**
 * Compute the complete ball flight path, normalized keyframe times, rebound
 * catch timing, and 1x transition duration from ``previous`` to ``current``.
 *
 * Continuity guarantee: the first point of frame ``k`` always matches the
 * final ``(x, y, z, held)`` state of frame ``k - 1``.
 */
export function computeBallFlightPlan(previous: Frame | null | undefined, current: Frame): BallFlightPlan {
  if (!previous) {
    const pos = renderedBallPosition(current);
    return {
      points: [{ x: pos.x, y: pos.y, z: 0, held: isFrameBallHeld(current) }],
      times: [0],
      durationMs: TRANSITION_DURATION_MS,
      reboundCatch: null,
      shotArcPeakFt: null,
      hasArc: false,
    };
  }

  const startPos = renderedBallPosition(previous);
  const startHeld = isFrameBallHeld(previous);
  const targetPos = renderedBallPosition(current);
  const targetHeld = isFrameBallHeld(current);
  const playerTravelMs = (maxPlayerTravelFt(previous, current) / BALL_SPEED_CAP_FT_S) * 1000;
  const isShot = current.trajectory?.type === 'shot';

  // 1. Frame immediately following a missed shot: rim -> rebounder (+ optional catch dwell & follow-up leg).
  if (isReboundFrame(previous, current)) {
    const rebounder = { x: previous.ball.x, y: previous.ball.y };
    const reboundDist = distance(startPos, rebounder);
    const followUpDist = distance(rebounder, targetPos);
    const lift = reboundDist > 0.5 ? reboundLiftFt(startPos, rebounder) : 2.5;
    const leg1Ms = clamp((reboundDist / REBOUND_SPEED_CAP_FT_S) * 1000, REBOUND_LEG_MIN_MS, REBOUND_LEG_MAX_MS);

    // Rebounder catches and immediately transitions into a move, pass, or putback shot.
    if (followUpDist > 0.5) {
      const holdMs = REBOUND_CATCH_HOLD_MS;
      const leg2Min = isShot ? SHOT_LEG_MIN_MS : REBOUND_FOLLOW_UP_MIN_MS;
      const leg2Ms = clamp((followUpDist / BALL_SPEED_CAP_FT_S) * 1000, leg2Min, REBOUND_FOLLOW_UP_MAX_MS);
      const rawTotalMs = leg1Ms + holdMs + leg2Ms;
      const durationMs = clamp(
        Math.max(rawTotalMs, playerTravelMs),
        REBOUND_LEG_MIN_MS + holdMs + REBOUND_FOLLOW_UP_MIN_MS,
        REBOUND_FRAME_MAX_MS,
      );

      const catchFraction = leg1Ms / rawTotalMs;
      const moveDelayFraction = (leg1Ms + holdMs) / rawTotalMs;

      const catchLegPoints = arcSamples(startPos, rebounder, lift, false, true);
      const catchLegTimes = PARABOLA_SAMPLES.map((t) => t * catchFraction);

      const points: FlightPathPoint[] = [...catchLegPoints];
      const times: number[] = [...catchLegTimes];

      // Explicit dwell keyframe so the ball settles visibly in the rebounder's hands.
      points.push({ x: rebounder.x, y: rebounder.y, z: 0, held: true });
      times.push(moveDelayFraction);

      let peakFt: number | null = null;
      if (isShot) {
        peakFt = shotArcPeakFt(rebounder, targetPos);
        const shotLegPoints = arcSamples(rebounder, targetPos, peakFt, true, false).slice(1);
        const shotLegTimes = PARABOLA_SAMPLES.slice(1).map((t) => moveDelayFraction + t * (1 - moveDelayFraction));
        points.push(...shotLegPoints);
        times.push(...shotLegTimes);
      } else {
        points.push({ x: targetPos.x, y: targetPos.y, z: 0, held: targetHeld });
        times.push(1);
      }

      return {
        points,
        times,
        durationMs,
        reboundCatch: {
          point: rebounder,
          timeFraction: catchFraction,
          moveDelayFraction,
        },
        shotArcPeakFt: peakFt,
        hasArc: true,
      };
    }

    // Rebounder stays in place (e.g. holds ball / draws foul): full parabolic bounce off the rim.
    const bouncePoints = arcSamples(startPos, targetPos, lift, false, targetHeld);
    const durationMs = clamp(Math.max(leg1Ms, playerTravelMs), REBOUND_LEG_MIN_MS, TRANSITION_DURATION_MAX_MS);

    return {
      points: bouncePoints,
      times: [...PARABOLA_SAMPLES],
      durationMs,
      reboundCatch: {
        point: rebounder,
        timeFraction: 1,
        moveDelayFraction: 1,
      },
      shotArcPeakFt: null,
      hasArc: true,
    };
  }

  // 2. Normal shot frame: parabolic arc from shooter to exact drawn hoop center.
  if (isShot) {
    const shotDist = distance(startPos, targetPos);
    const peakFt = shotArcPeakFt(startPos, targetPos);
    const shotPoints = arcSamples(startPos, targetPos, peakFt, startHeld, false);
    const durationMs = clamp(
      Math.max((shotDist / BALL_SPEED_CAP_FT_S) * 1000, playerTravelMs),
      SHOT_LEG_MIN_MS,
      TRANSITION_DURATION_MAX_MS,
    );

    return {
      points: shotPoints,
      times: [...PARABOLA_SAMPLES],
      durationMs,
      reboundCatch: null,
      shotArcPeakFt: peakFt,
      hasArc: true,
    };
  }

  // 3. Normal pass, inbound, dribble, or kickoff formation reset.
  const ballDist = distance(startPos, targetPos);
  const durationMs = clamp(
    Math.max((ballDist / BALL_SPEED_CAP_FT_S) * 1000, playerTravelMs),
    TRANSITION_DURATION_MIN_MS,
    TRANSITION_DURATION_MAX_MS,
  );

  return {
    points: [
      { x: startPos.x, y: startPos.y, z: 0, held: startHeld },
      { x: targetPos.x, y: targetPos.y, z: 0, held: targetHeld },
    ],
    times: [0, 1],
    durationMs,
    reboundCatch: null,
    shotArcPeakFt: null,
    hasArc: false,
  };
}

/** Convenience helper returning only the flight path points for a frame pair. */
export function ballFlightPath(previous: Frame | null | undefined, current: Frame): FlightPathPoint[] {
  return computeBallFlightPlan(previous, current).points;
}

/** Convenience helper returning rebound catch metadata for a frame pair. */
export function reboundCatch(previous: Frame | null | undefined, current: Frame): ReboundCatch | null {
  return computeBallFlightPlan(previous, current).reboundCatch;
}
