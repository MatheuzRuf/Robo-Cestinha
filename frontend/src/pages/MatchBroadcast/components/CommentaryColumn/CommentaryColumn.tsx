import { LogPanel } from '../../../../components/LogPanel';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { CommentaryEntry } from '../../data/mockMatchData';
import styles from '../../MatchBroadcast.module.css';

export function CommentaryColumn({ entries, isPaused }: { entries: CommentaryEntry[]; isPaused: boolean }) {
  const { t } = useTranslation();

  return (
    <LogPanel
      title={t('match_broadcast.commentary.title')}
      entriesKey={entries.at(-1)?.id ?? ''}
      footer={<span className={styles.voice}>{isPaused ? ' · PAUSED' : ''}</span>}
    >
      {entries.map((entry) => (
        <article className={styles.commentaryEntry} key={entry.id}>
          <span className={styles.logClock}>{entry.gameClock}</span>
          <p>&ldquo;{entry.text}&rdquo;</p>
        </article>
      ))}
    </LogPanel>
  );
}
