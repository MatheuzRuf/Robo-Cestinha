import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

interface SimulationProgressProps {
  currentFrame: number;
  totalFrames: number;
  isPaused: boolean;
  isComplete: boolean;
  onSeek: (frameIndex: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

const seekKeys = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp']);

export function SimulationProgress({
  currentFrame,
  totalFrames,
  isPaused,
  isComplete,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onTogglePause,
  onRestart,
}: SimulationProgressProps) {
  const { t } = useTranslation();
  const currentFrameIndex = Math.max(0, Math.min(currentFrame - 1, totalFrames - 1));

  return (
    <section className={styles.progress}>
      {isComplete ? (
        <Button variant="outline" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={onRestart}>
          {t('match_broadcast.simulation.replay')}
        </Button>
      ) : (
        <Button
          variant="outline"
          icon={isPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          onClick={onTogglePause}
        >
          {t(isPaused ? 'match_broadcast.clock.resume' : 'match_broadcast.clock.pause')}
        </Button>
      )}
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
