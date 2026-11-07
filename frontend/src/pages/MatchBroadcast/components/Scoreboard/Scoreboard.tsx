import { CircleDot } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { SimulationTeam, Speed } from '../../../../types/matchBroadcast';
import styles from '../../MatchBroadcast.module.css';

function TeamSummaryBlock({
  side,
  team,
  score,
  hasPossession,
}: {
  side: 'home' | 'away';
  team: SimulationTeam;
  score: number;
  hasPossession: boolean;
}) {
  return (
    <div className={`${styles.teamSummary} ${side === 'away' ? styles.awaySummary : ''}`}>
      <div className={styles.teamCopy}>
        <strong>{team.name}</strong>
        <span className={styles.teamMeta}>
          {hasPossession ? <CircleDot className={styles.possessionIcon} size={12} aria-hidden="true" /> : null}
          {team.abbreviation}
        </span>
      </div>
      <strong className={styles.score}>{score}</strong>
    </div>
  );
}

type ScoreboardProps = {
  homeTeam: SimulationTeam;
  awayTeam: SimulationTeam;
  homeScore: number;
  awayScore: number;
  possessionTeamId: string | null;
  frameNumber: number;
  totalFrames: number;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isPaused: boolean;
  isComplete: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
};

export function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  possessionTeamId,
  frameNumber,
  totalFrames,
  speed,
  setSpeed,
  isPaused,
  isComplete,
  onTogglePause,
  onRestart,
}: ScoreboardProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.scoreboard}>
      <TeamSummaryBlock
        side="home"
        team={homeTeam}
        score={homeScore}
        hasPossession={possessionTeamId === homeTeam.teamId}
      />
      <div className={styles.clockPanel}>
        <span className={styles.frameLabel}>
          {isComplete
            ? t('match_broadcast.simulation.completed')
            : t('match_broadcast.simulation.frame_progress', { current: frameNumber, total: totalFrames })}
        </span>
        <SegmentedControl
          label={t('match_broadcast.clock.speed_label')}
          options={[
            { value: '1', label: '1.0X' },
            { value: '1.5', label: '1.5X' },
            { value: '2', label: '2.0X' },
          ]}
          value={String(speed)}
          onChange={(value) => setSpeed(Number(value) as Speed)}
        />
        {isComplete ? (
          <Button variant="outline" onClick={onRestart}>
            {t('match_broadcast.simulation.replay')}
          </Button>
        ) : (
          <Button variant="outline" onClick={onTogglePause}>
            {isPaused ? t('match_broadcast.clock.resume') : t('match_broadcast.clock.pause')}
          </Button>
        )}
      </div>
      <TeamSummaryBlock
        side="away"
        team={awayTeam}
        score={awayScore}
        hasPossession={possessionTeamId === awayTeam.teamId}
      />
    </section>
  );
}
