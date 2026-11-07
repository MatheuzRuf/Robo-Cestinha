import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

interface SimulationProgressProps {
  currentFrame: number;
  totalFrames: number;
}

export function SimulationProgress({ currentFrame, totalFrames }: SimulationProgressProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.progress}>
      <span className={styles.progressLabel}>
        {t('match_broadcast.simulation.frame_progress', { current: currentFrame, total: totalFrames })}
      </span>
      <div className={styles.progressTrack}>
        <progress className={styles.progressBar} value={currentFrame} max={Math.max(1, totalFrames)} />
      </div>
    </section>
  );
}
