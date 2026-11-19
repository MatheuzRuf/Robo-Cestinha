import { API_BASE_URL } from '../config/api';
import type { CommentarySnapshot } from '../pages/MatchBroadcast/commentarySnapshot';

const MAX_SNAPSHOTS_PER_REQUEST = 250;

export interface CommentaryFrameResult {
  f: number;
  c: string | null;
}

export async function generateCommentaryBatch(
  snapshots: CommentarySnapshot[],
  signal: AbortSignal,
): Promise<CommentaryFrameResult[]> {
  if (snapshots.length === 0) return [];

  const commentaries: CommentaryFrameResult[] = [];
  for (let offset = 0; offset < snapshots.length; offset += MAX_SNAPSHOTS_PER_REQUEST) {
    const batch = snapshots.slice(offset, offset + MAX_SNAPSHOTS_PER_REQUEST);
    const response = await fetch(`${API_BASE_URL}/commentary/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshots: batch }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Commentary request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { commentaries: CommentaryFrameResult[] };
    if (!Array.isArray(payload.commentaries)) {
      throw new Error('Commentary response did not include frame-indexed results');
    }
    commentaries.push(...payload.commentaries);
  }

  return commentaries;
}
