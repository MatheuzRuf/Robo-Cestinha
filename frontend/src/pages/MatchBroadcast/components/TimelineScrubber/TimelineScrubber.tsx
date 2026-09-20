import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

export function TimelineScrubber() {
  const { t } = useTranslation();

  return (
    <section className={styles.timeline}>
      <div className={styles.timelineLabels}>
        <b>{t('match_broadcast.timeline.label')}</b>
        <span>10:18 / 00:00</span>
      </div>
      <div className={styles.timelineTrack}>
        <span />
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
