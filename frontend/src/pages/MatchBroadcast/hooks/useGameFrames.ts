import { useEffect, useRef, useState } from 'react';
import type { Frame } from '../../../types/game';

export const TRANSITION_DURATION_MS = 800;

function clampFrameIndex(frameIndex: number, frameCount: number) {
  return Math.max(0, Math.min(frameIndex, frameCount - 1));
}

interface PlaybackState {
  frames: Frame[];
  frameIndex: number;
  isPaused: boolean;
}

export function useGameFrames(frames: Frame[], initialFrameIndex = 0) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() => ({
    frames,
    frameIndex: clampFrameIndex(initialFrameIndex, frames.length),
    isPaused: false,
  }));
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const isSeeking = useRef(false);
  const shouldResumeAfterSeek = useRef(false);
  const isCurrentSequence = playbackState.frames === frames;
  const frameIndex = isCurrentSequence ? playbackState.frameIndex : clampFrameIndex(initialFrameIndex, frames.length);
  const isPaused = isCurrentSequence && playbackState.isPaused;

  useEffect(() => {
    if (isPaused || frameIndex >= frames.length - 1) return;

    const timeoutId = window.setTimeout(() => {
      setPlaybackState((currentState) => {
        const currentIndex =
          currentState.frames === frames ? currentState.frameIndex : clampFrameIndex(initialFrameIndex, frames.length);
        const currentPaused = currentState.frames === frames && currentState.isPaused;
        return {
          frames,
          frameIndex: Math.min(currentIndex + 1, frames.length - 1),
          isPaused: currentPaused,
        };
      });
    }, TRANSITION_DURATION_MS / speed);

    return () => window.clearTimeout(timeoutId);
  }, [frameIndex, frames, initialFrameIndex, isPaused, speed]);

  function pause() {
    setPlaybackState({ frames, frameIndex, isPaused: true });
  }

  function resume() {
    setPlaybackState({ frames, frameIndex, isPaused: false });
  }

  function restart() {
    setPlaybackState({ frames, frameIndex: 0, isPaused: false });
  }

  function seek(nextFrameIndex: number) {
    setPlaybackState({
      frames,
      frameIndex: clampFrameIndex(nextFrameIndex, frames.length),
      isPaused: true,
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
    transitionDurationMs: TRANSITION_DURATION_MS / speed,
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
