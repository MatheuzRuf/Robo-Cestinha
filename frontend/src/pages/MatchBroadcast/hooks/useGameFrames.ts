import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frame, PlayerState } from '../../../types/game';

/** Baseline duration when no movement data is available (edge frames). */
export const TRANSITION_DURATION_MS = 800;
/** Fast but humanly plausible ball speed used to derive advance durations. */
export const BALL_SPEED_CAP_FT_S = 20;
export const TRANSITION_DURATION_MIN_MS = 280;
export const TRANSITION_DURATION_MAX_MS = 1600;

export interface RenderedBall {
  x: number;
  y: number;
}

export type FlightPathPoint = RenderedBall;

/** Parabolic shot arc peak (feet) scaled by flight length (D8a). */
function shotArcPeakFt(from: FlightPathPoint, to: FlightPathPoint): number {
  const length = distance(from, to);
  return Math.max(6, Math.min(12, length * 0.22));
}

/** Catch lift (feet) as the ball drops off the rim to the rebounder. */
function reboundLiftFt(from: FlightPathPoint, to: FlightPathPoint): number {
  const length = distance(from, to);
  return Math.max(3, Math.min(6, length * 0.2));
}

function liftedLeg(from: FlightPathPoint, to: FlightPathPoint, liftFt: number): FlightPathPoint[] {
  const apex = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - liftFt };
  return [from, apex, to];
}

/**
 * True when ``previous`` is a missed-shot frame whose rebound is resolved by
 * the holder captured on that frame. Made baskets are excluded because their
 * following frame is the kickoff reset (phase ``"kickoff"``).
 */
function isReboundFrame(previous: Frame, current: Frame): boolean {
  return previous.trajectory?.type === 'shot' && current.phase !== 'kickoff';
}

/**
 * The complete ball flight polyline displayed together with ``current``: from
 * the previous frame's rendered position to this frame's target, with a shot
 * arc apex on legs reaching the rim and a catch lift on the rebound leg
 * (rim -> rebounder -> target) after a missed shot (D6a).
 *
 * Points are in court feet; the first point equals the position the ball
 * holds when this frame starts, so the keyframed animation is seamless.
 */
export function ballFlightPath(previous: Frame | null | undefined, current: Frame): FlightPathPoint[] {
  if (!previous) return [renderedBallPosition(current)];
  const start = renderedBallPosition(previous);
  const target = renderedBallPosition(current);
  let base: FlightPathPoint[] = [start, target];
  if (isReboundFrame(previous, current)) {
    const rebounder = { x: previous.ball.x, y: previous.ball.y };
    if (distance(start, rebounder) > 0.5 && distance(rebounder, target) > 0.5) {
      base = [start, rebounder, target];
    }
  }
  return withArcs(base, current);
}

function withArcs(base: FlightPathPoint[], current: Frame): FlightPathPoint[] {
  const isShot = current.trajectory?.type === 'shot';
  if (!isShot) {
    if (base.length === 3) {
      const [rim, rebounder, target] = base;
      if (distance(rim, rebounder) > 1) {
        return [...liftedLeg(rim, rebounder, reboundLiftFt(rim, rebounder)).slice(0, -1), rebounder, target];
      }
    }
    return base;
  }

  if (base.length === 2) {
    const [from, to] = base;
    if (distance(from, to) > 1) return liftedLeg(from, to, shotArcPeakFt(from, to));
    return base;
  }

  // Rebound followed by an immediate re-shot: lift off the rim, then arc.
  const [rim, rebounder, target] = base;
  const catchLeg =
    distance(rim, rebounder) > 1 ? liftedLeg(rim, rebounder, reboundLiftFt(rim, rebounder)).slice(0, -1) : [rim];
  const shotLeg =
    distance(rebounder, target) > 1
      ? liftedLeg(rebounder, target, shotArcPeakFt(rebounder, target))
      : [rebounder, target];
  return [...catchLeg, ...shotLeg];
}

function pathLength(path: readonly FlightPathPoint[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distance(path[index - 1], path[index]);
  }
  return total;
}

/**
 * Position the animated ball should render at for a frame: while a shot
 * trajectory is attached, the ball sits at the trajectory end (the rim)
 * instead of the next holder's spot. This keeps the animated ball on the
 * drawn shot line (D6a).
 */
export function renderedBallPosition(frame: Frame): RenderedBall {
  if (frame.trajectory?.type === 'shot') {
    return { x: frame.trajectory.to.x, y: frame.trajectory.to.y };
  }
  return { x: frame.ball.x, y: frame.ball.y };
}

function distance(a: RenderedBall, b: RenderedBall): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playerDistance(a: PlayerState, b: PlayerState): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Duration of the movement displayed on frame ``index``: the ball flight and
 * the furthest player travel from frame ``index - 1`` to frame ``index``,
 * capped by a plausible ball speed (D7a).
 *
 * Using the movement *into* the frame means the ball animation and the frame
 * advance timeout share the same travelled path, so every flight (including
 * the waypointed rebound leg and shot arc) completes exactly when the next
 * frame mounts instead of being interrupted mid-air. Formation resets take
 * longer, short passes stay near the old 800 ms baseline, and far jumps are
 * slowed instead of teleported. Legacy stored replays benefit without
 * contract changes.
 */
function advanceDurationMs(frames: Frame[], index: number): number {
  const previous = frames[index - 1];
  const current = frames[index];
  if (!previous || !current) return TRANSITION_DURATION_MS;

  const ballFeet = pathLength(ballFlightPath(previous, current));
  const currentById = new Map(current.players.map((player) => [player.id, player]));
  let playerFeet = 0;
  for (const player of previous.players) {
    const currentPosition = currentById.get(player.id);
    if (currentPosition) {
      playerFeet = Math.max(playerFeet, playerDistance(player, currentPosition));
    }
  }

  const travelSeconds = Math.max(ballFeet, playerFeet) / BALL_SPEED_CAP_FT_S;
  const clampedSeconds = Math.min(
    TRANSITION_DURATION_MAX_MS / 1000,
    Math.max(TRANSITION_DURATION_MIN_MS / 1000, travelSeconds),
  );
  return clampedSeconds * 1000;
}

function clampFrameIndex(frameIndex: number, frameCount: number) {
  return Math.max(0, Math.min(frameIndex, frameCount - 1));
}

interface PlaybackState {
  frames: Frame[];
  frameIndex: number;
  isPaused: boolean;
  hasCompletedPlayback: boolean;
  hasSkippedFrames: boolean;
}

export function useGameFrames(frames: Frame[], initialFrameIndex = 0, initialHasSkippedFrames = false) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() => ({
    frames,
    frameIndex: clampFrameIndex(initialFrameIndex, frames.length),
    isPaused: false,
    hasCompletedPlayback: false,
    hasSkippedFrames: initialHasSkippedFrames,
  }));
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const isSeeking = useRef(false);
  const shouldResumeAfterSeek = useRef(false);
  const isCurrentSequence = playbackState.frames === frames;
  const frameIndex = isCurrentSequence ? playbackState.frameIndex : clampFrameIndex(initialFrameIndex, frames.length);
  const isPaused = isCurrentSequence && playbackState.isPaused;
  const advanceDurations = useMemo(() => frames.map((_, index) => advanceDurationMs(frames, index)), [frames]);

  useEffect(() => {
    if (isPaused || frameIndex >= frames.length - 1) return;

    const advanceMs = advanceDurations[frameIndex] ?? TRANSITION_DURATION_MS;
    const timeoutId = window.setTimeout(() => {
      setPlaybackState((currentState) => {
        const isCurrentSequence = currentState.frames === frames;
        const currentIndex = isCurrentSequence
          ? currentState.frameIndex
          : clampFrameIndex(initialFrameIndex, frames.length);
        const currentPaused = isCurrentSequence && currentState.isPaused;
        const currentHasSkippedFrames = isCurrentSequence ? currentState.hasSkippedFrames : initialHasSkippedFrames;
        const nextFrameIndex = Math.min(currentIndex + 1, frames.length - 1);
        return {
          frames,
          frameIndex: nextFrameIndex,
          isPaused: currentPaused,
          hasCompletedPlayback:
            (isCurrentSequence && currentState.hasCompletedPlayback) ||
            (!currentHasSkippedFrames && nextFrameIndex === frames.length - 1),
          hasSkippedFrames: currentHasSkippedFrames,
        };
      });
    }, advanceMs / speed);

    return () => window.clearTimeout(timeoutId);
  }, [advanceDurations, frameIndex, frames, initialFrameIndex, initialHasSkippedFrames, isPaused, speed]);

  function pause() {
    setPlaybackState({
      frames,
      frameIndex,
      isPaused: true,
      hasCompletedPlayback: playbackState.frames === frames && playbackState.hasCompletedPlayback,
      hasSkippedFrames: playbackState.frames === frames && playbackState.hasSkippedFrames,
    });
  }

  function resume() {
    setPlaybackState({
      frames,
      frameIndex,
      isPaused: false,
      hasCompletedPlayback: playbackState.frames === frames && playbackState.hasCompletedPlayback,
      hasSkippedFrames: playbackState.frames === frames ? playbackState.hasSkippedFrames : initialHasSkippedFrames,
    });
  }

  function restart() {
    setPlaybackState({
      frames,
      frameIndex: 0,
      isPaused: false,
      hasCompletedPlayback: false,
      hasSkippedFrames: false,
    });
  }

  function seek(nextFrameIndex: number) {
    setPlaybackState({
      frames,
      frameIndex: clampFrameIndex(nextFrameIndex, frames.length),
      isPaused: true,
      hasCompletedPlayback: playbackState.frames === frames && playbackState.hasCompletedPlayback,
      hasSkippedFrames: true,
    });
  }

  function beginSeeking() {
    if (isSeeking.current) return;
    isSeeking.current = true;
    shouldResumeAfterSeek.current = !isPaused && frameIndex < frames.length - 1;
    pause();
  }

  function endSeeking() {
    if (!isSeeking.current) return;
    isSeeking.current = false;
    if (shouldResumeAfterSeek.current) resume();
    shouldResumeAfterSeek.current = false;
  }

  const currentFrameIndex = Math.min(frameIndex, Math.max(0, frames.length - 1));

  return {
    frame: frames[currentFrameIndex] ?? null,
    frameIndex: currentFrameIndex,
    isComplete: frames.length > 0 && currentFrameIndex === frames.length - 1,
    hasCompletedPlayback: isCurrentSequence && playbackState.hasCompletedPlayback,
    hasSkippedFrames: isCurrentSequence ? playbackState.hasSkippedFrames : initialHasSkippedFrames,
    transitionDurationMs: (advanceDurations[currentFrameIndex] ?? TRANSITION_DURATION_MS) / speed,
    speed,
    setSpeed,
    isPaused,
    pause,
    resume,
    restart,
    seek,
    beginSeeking,
    endSeeking,
  };
}
