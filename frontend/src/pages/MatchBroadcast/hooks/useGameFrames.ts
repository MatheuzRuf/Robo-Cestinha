import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frame } from '../../../types/game';
import {
  BALL_SPEED_CAP_FT_S,
  TRANSITION_DURATION_MAX_MS,
  TRANSITION_DURATION_MIN_MS,
  TRANSITION_DURATION_MS,
  ballFlightPath,
  computeBallFlightPlan,
  reboundCatch,
  renderedBallPosition,
  type BallFlightPlan,
  type FlightPathPoint,
  type ReboundCatch,
  type RenderedBall,
} from './ballFlight';

export {
  BALL_SPEED_CAP_FT_S,
  TRANSITION_DURATION_MAX_MS,
  TRANSITION_DURATION_MIN_MS,
  TRANSITION_DURATION_MS,
  ballFlightPath,
  computeBallFlightPlan,
  reboundCatch,
  renderedBallPosition,
  type BallFlightPlan,
  type FlightPathPoint,
  type ReboundCatch,
  type RenderedBall,
};

function advanceDurationMs(frames: Frame[], index: number): number {
  const previous = frames[index - 1];
  const current = frames[index];
  if (!previous || !current) return TRANSITION_DURATION_MS;
  return computeBallFlightPlan(previous, current).durationMs;
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
