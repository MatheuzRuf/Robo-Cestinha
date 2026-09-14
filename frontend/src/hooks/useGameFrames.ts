import { useEffect, useRef, useState } from 'react';
import type { Frame } from '../types/game';
import { startMockEngine } from '../mock/mockEngine';

export const ENGINE_TICK_MS = 800;
export const TRANSITION_DURATION_MS = 800;
const MAX_QUEUE_SIZE = 5;

export function useGameFrames() {
  const [frame, setFrame] = useState<Frame | null>(null);
  const queueRef = useRef<Frame[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function playNext() {
      const queue = queueRef.current;

      while (queue.length > MAX_QUEUE_SIZE) {
        queue.shift();
      }

      if (queue.length === 0) {
        isPlayingRef.current = false;
        return;
      }

      const next = queue.shift()!;
      isPlayingRef.current = true;
      setFrame(next);
      timeoutId = setTimeout(playNext, TRANSITION_DURATION_MS);
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
    };
  }, []);

  return { frame, transitionDurationMs: TRANSITION_DURATION_MS };
}