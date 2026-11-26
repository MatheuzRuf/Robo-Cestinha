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

/**
 * True when ``previous`` is a missed-shot frame whose rebound is resolved by
 * the holder captured on that frame. Made baskets are excluded because their
 * following frame is the kickoff reset (phase ``"kickoff"``).
 */
function isReboundFrame(previous: Frame, current: Frame): boolean {
  return previous.trajectory?.type === 'shot' && current.phase !== 'kickoff';
}

/**
 * Ball flight polyline for the animation displayed with ``current``.
 *
 * After a missed shot the ball leaves the rim toward the rebounder (the next
 * holder, whose catch position is kept on the shot frame's ball data) before
 * continuing to the next frame's target. All other transitions keep the plain
 * rendered target so the ball eases directly there (D6a frontend synthesis).
 */
export function ballFlightPath(previous: Frame | null | undefined, current: Frame): FlightPathPoint[] {
  const target = renderedBallPosition(current);
  if (!previous || !isReboundFrame(previous, current)) return [target];
  const rim = renderedBallPosition(previous);
  const rebounder = { x: previous.ball.x, y: previous.ball.y };
  if (distance(rim, rebounder) < 0.5 || distance(rebounder, target) < 0.5) {
    return [target];
  }
  return [rim, rebounder, target];
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
 * Duration of the advance from frame ``index`` to ``index + 1``: the greater
 * of the ball travel and the furthest player travel, capped by a plausible
 * ball speed (D7a). Formation resets therefore take longer, short passes stay
 * near the old 800 ms baseline, and far jumps are slowed instead of
 * teleported. Legacy stored replays benefit without contract changes.
 */
function advanceDurationMs(frames: Frame[], index: number): number {
  const current = frames[index];
  const next = frames[index + 1];
  if (!current || !next) return TRANSITION_DURATION_MS;

  // The ball follows a rim -> rebounder -> target path right after a rebound,
  // so the advance timing must account for the extra waypoint.
  const ballFeet = pathLength(ballFlightPath(current, next));
  const nextById = new Map(next.players.map((player) => [player.id, player]));
  let playerFeet = 0;
  for (const player of current.players) {
    const nextPosition = nextById.get(player.id);
    if (nextPosition) {
      playerFeet = Math.max(playerFeet, playerDistance(player, nextPosition));
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
