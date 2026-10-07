import { useEffect, useRef, useState } from 'react';
import type { Frame } from '../../../types/game';

export const TRANSITION_DURATION_MS = 800;
const MAX_QUEUE_SIZE = 5;

interface PlaybackState {
  paused: boolean;
  speed: 1 | 1.5 | 2;
  playing: boolean;
  timeoutId?: number;
}

export function useGameFrames(incomingFrame: Frame | null) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isPaused, setIsPaused] = useState(false);
  const queueRef = useRef<Frame[]>([]);
  const playbackRef = useRef<PlaybackState>({ paused: false, speed: 1, playing: false });
  const playNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    const playback = playbackRef.current;

    function playNext() {
      if (playback.paused || playback.playing || queueRef.current.length === 0) return;

      const next = queueRef.current.shift();
      if (!next) return;

      playback.playing = true;
      setFrame(next);
      playback.timeoutId = window.setTimeout(() => {
        playback.playing = false;
        playback.timeoutId = undefined;
        playNextRef.current();
      }, TRANSITION_DURATION_MS / playback.speed);
    }

    playNextRef.current = playNext;

    return () => {
      if (playback.timeoutId) window.clearTimeout(playback.timeoutId);
      playback.timeoutId = undefined;
      playback.playing = false;
      queueRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!incomingFrame) {
      queueRef.current = [];
      const playback = playbackRef.current;
      if (playback.timeoutId) window.clearTimeout(playback.timeoutId);
      playback.timeoutId = undefined;
      playback.playing = false;
      return;
    }

    queueRef.current.push(incomingFrame);
    while (queueRef.current.length > MAX_QUEUE_SIZE) queueRef.current.shift();
    playNextRef.current();
  }, [incomingFrame]);

  useEffect(() => {
    const playback = playbackRef.current;
    playback.paused = isPaused;
    playback.speed = speed;

    if (isPaused && playback.timeoutId) {
      window.clearTimeout(playback.timeoutId);
      playback.timeoutId = undefined;
      playback.playing = false;
    } else if (!isPaused) {
      playNextRef.current();
    }
  }, [isPaused, speed]);

  function pause() {
    setIsPaused(true);
  }

  function resume() {
    setIsPaused(false);
  }

  return {
    frame: incomingFrame === null ? null : frame,
    transitionDurationMs: TRANSITION_DURATION_MS / speed,
    speed,
    setSpeed,
    isPaused,
    pause,
    resume,
  };
}
