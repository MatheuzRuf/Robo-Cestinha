import { useEffect, useRef, useState } from 'react';
import type { Frame } from '../types/game';
import { startMockEngine } from '../mock/mockEngine';

export const ENGINE_TICK_MS = 800;
export const TRANSITION_DURATION_MS = 800;
const MAX_QUEUE_SIZE = 5;

export function useGameFrames() {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isPaused, setIsPaused] = useState(false);
  const queueRef = useRef<Frame[]>([]);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(speed);
  const pausedRef = useRef(isPaused);

  useEffect(() => {
    speedRef.current = speed;
    pausedRef.current = isPaused;
  }, [isPaused, speed]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function playNext() {
      const queue = queueRef.current;

      while (queue.length > MAX_QUEUE_SIZE) {
        queue.shift();
      }

      if (queue.length === 0 || pausedRef.current) {
        isPlayingRef.current = false;
        return;
      }

      const next = queue.shift()!;
      isPlayingRef.current = true;
      setFrame(next);
      timeoutId = setTimeout(playNext, TRANSITION_DURATION_MS / speedRef.current);
    }

    function onFrame(newFrame: Frame) {
      queueRef.current.push(newFrame);
      if (!isPlayingRef.current) {
        playNext();
      }
    }

    const stopEngine = startMockEngine(onFrame, ENGINE_TICK_MS);

    return () => {
      stopEngine();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      queueRef.current = [];
      isPlayingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isPaused && !isPlayingRef.current && queueRef.current.length > 0) {
      const next = queueRef.current.shift();

      if (next) {
        setFrame(next);
        isPlayingRef.current = true;

        window.setTimeout(() => {
          isPlayingRef.current = false;

          if (queueRef.current.length > 0 && !pausedRef.current) {
            setFrame(queueRef.current.shift()!);
            isPlayingRef.current = true;
          }
        }, TRANSITION_DURATION_MS / speedRef.current);
      }
    }
  }, [isPaused, speed]);

  function pause() {
    setIsPaused(true);
  }

  function resume() {
    setIsPaused(false);
  }

  return {
    frame,
    transitionDurationMs: TRANSITION_DURATION_MS / speed,
    speed,
    setSpeed,
    isPaused,
    pause,
    resume,
  };
}
