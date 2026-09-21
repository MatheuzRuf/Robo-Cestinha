import { LogPanel } from '../../../../components/LogPanel';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { PlayByPlayLogEntry } from '../../data/mockMatchData';
import styles from '../../MatchBroadcast.module.css';

export function PlayByPlayColumn({ entries }: { entries: PlayByPlayLogEntry[] }) {
  const { t } = useTranslation();

  return (
    <LogPanel title={t('match_broadcast.play_by_play.title')} entriesKey={entries.at(-1)?.id ?? ''}>
      {entries.map((entry) => (
        <div className={styles.logEntry} key={entry.id}>
          <span
            className={`${styles.eventTag} ${entry.type.includes('FOUL') ? styles.foul : entry.type.includes('MADE') ? styles.made : ''}`}
          >
            {entry.type}
          </span>
          <span className={styles.logClock}>{entry.gameClock}</span>
          <p>{entry.description}</p>
        </div>
      ))}
    </LogPanel>
  );
}
