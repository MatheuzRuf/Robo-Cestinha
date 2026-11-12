import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

interface SimulationProgressProps {
  currentFrame: number;
  totalFrames: number;
  onSeek: (frameIndex: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
}

const seekKeys = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp']);

export function SimulationProgress({
  currentFrame,
  totalFrames,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: SimulationProgressProps) {
  const { t } = useTranslation();
  const currentFrameIndex = Math.max(0, Math.min(currentFrame - 1, totalFrames - 1));

  return (
    <section className={styles.progress}>
      <span className={styles.progressLabel}>
        {t('match_broadcast.simulation.frame_progress', { current: currentFrame, total: totalFrames })}
      </span>
      <div className={styles.progressTrack}>
        <progress
          className={styles.progressBar}
          value={currentFrameIndex}
          max={Math.max(1, totalFrames - 1)}
          aria-hidden="true"
        />
        <input
          className={styles.seekSlider}
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          step={1}
          value={currentFrameIndex}
          aria-label={t('match_broadcast.simulation.seek_label')}
          aria-valuetext={t('match_broadcast.simulation.frame_progress', {
            current: currentFrameIndex + 1,
            total: totalFrames,
          })}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          onPointerDown={onSeekStart}
          onPointerUp={onSeekEnd}
          onPointerCancel={onSeekEnd}
          onKeyDown={(event) => {
            if (seekKeys.has(event.key)) onSeekStart();
          }}
          onKeyUp={(event) => {
            if (seekKeys.has(event.key)) onSeekEnd();
          }}
          onBlur={onSeekEnd}
        />
      </div>
    </section>
  );
}
