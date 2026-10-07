import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

interface TimelineScrubberProps {
  quarter: number;
  elapsedSeconds: number;
  durationSeconds: number;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return `${Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(safeSeconds % 60).toString().padStart(2, '0')}`;
}

export function TimelineScrubber({ quarter, elapsedSeconds, durationSeconds }: TimelineScrubberProps) {
  const { t } = useTranslation();
  const duration = Math.max(1, durationSeconds);

  return (
    <section className={styles.timeline}>
      <div className={styles.timelineLabels}>
        <b>{t('match_broadcast.timeline.label', { quarter })}</b>
        <span>
          {formatTime(elapsedSeconds)} / {formatTime(duration)}
        </span>
      </div>
      <div className={styles.timelineTrack}>
        <progress className={styles.timelineProgress} value={Math.min(elapsedSeconds, duration)} max={duration} />
      </div>
      <div className={styles.timelineButtons}>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.previous')}>
          ◀
        </button>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.play')}>
          ▶
        </button>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.next')}>
          ▶
        </button>
      </div>
    </section>
  );
}
