const PREVIOUS_EVENT_INTERVAL = 5;
const FREQUENCY_MULTIPLIER = 1.5;

export function sampleCommentaryFrames<T>(frames: readonly T[]): T[] {
  if (frames.length === 0) return [];

  const previousCount = Math.ceil(frames.length / PREVIOUS_EVENT_INTERVAL);
  const targetCount = Math.min(
    frames.length,
    Math.ceil(previousCount * FREQUENCY_MULTIPLIER),
  );
  if (targetCount === 1) return [frames[frames.length - 1]];

  return Array.from({ length: targetCount }, (_, index) => {
    const frameIndex = Math.round((index * (frames.length - 1)) / (targetCount - 1));
    return frames[frameIndex];
  });
}
