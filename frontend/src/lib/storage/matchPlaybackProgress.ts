export interface MatchPlaybackProgress {
  frameIndex: number;
  iteration: number;
  isComplete: boolean;
}

export interface MatchPlaybackContext {
  sessionHash: string;
  userId: string;
  matchId: string;
}

const STORAGE_KEY_PREFIX = 'robo-cestinha-match-playback';

function getStorageKey({ sessionHash, userId, matchId }: MatchPlaybackContext) {
  return [STORAGE_KEY_PREFIX, sessionHash, userId, matchId].map(encodeURIComponent).join(':');
}

export function getMatchPlaybackProgress(context: MatchPlaybackContext): MatchPlaybackProgress | null {
  try {
    const stored = window.localStorage.getItem(getStorageKey(context));
    if (!stored) return null;

    const progress = JSON.parse(stored) as Partial<MatchPlaybackProgress>;
    if (
      !Number.isInteger(progress.frameIndex) ||
      (progress.frameIndex ?? -1) < 0 ||
      !Number.isInteger(progress.iteration) ||
      typeof progress.isComplete !== 'boolean'
    ) {
      return null;
    }

    return {
      frameIndex: progress.frameIndex as number,
      iteration: progress.iteration as number,
      isComplete: progress.isComplete,
    };
  } catch {
    return null;
  }
}

export function saveMatchPlaybackProgress(context: MatchPlaybackContext, progress: MatchPlaybackProgress) {
  try {
    window.localStorage.setItem(getStorageKey(context), JSON.stringify(progress));
  } catch {
    return;
  }
}

export function clearMatchPlaybackProgress(context: MatchPlaybackContext) {
  try {
    window.localStorage.removeItem(getStorageKey(context));
  } catch {
    return;
  }
}
