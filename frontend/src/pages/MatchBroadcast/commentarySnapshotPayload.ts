import type { CommentarySnapshot } from './commentarySnapshot';

export type CommentarySnapshotPayload = Omit<CommentarySnapshot, 'facts' | 'topFact'> & {
  fx: { k: string; t: string }[];
};

export function serializeCommentarySnapshot(snapshot: CommentarySnapshot): CommentarySnapshotPayload {
  return {
    f: snapshot.f,
    tf: snapshot.tf,
    ev: snapshot.ev,
    st: snapshot.st,
    fx: snapshot.facts.map(({ kind, text }) => ({ k: kind, t: text })),
  };
}
