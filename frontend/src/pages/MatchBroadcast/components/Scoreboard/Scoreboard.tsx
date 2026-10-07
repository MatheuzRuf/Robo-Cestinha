import { Button } from '../../../../components/Button';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { MatchSnapshot, Speed, TeamSummary } from '../../../../types/matchBroadcast';
import styles from '../../MatchBroadcast.module.css';

function TeamSummaryBlock({ side, team }: { side: 'home' | 'away'; team: TeamSummary }) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.teamSummary} ${side === 'away' ? styles.awaySummary : ''}`}>
      <div className={styles.teamCopy}>
        <span className={styles.seed}>{team.seed}</span>
        <strong>{team.name}</strong>
        <span className={styles.teamMeta}>
          {team.possession ? '◀ ' : ''}
          {team.abbreviation}
        </span>
      </div>
      <strong className={styles.score}>{team.score}</strong>
      <span className={styles.teamStats}>
        {t('match_broadcast.scoreboard.fouls_label')}{' '}
        <b>
          {team.fouls.current}/{team.fouls.max}
        </b>{' '}
        · {t('match_broadcast.scoreboard.timeouts_label')}{' '}
        <b>
          {team.timeouts.remaining}/{team.timeouts.total}
        </b>
      </span>
    </div>
  );
}

type ScoreboardProps = {
  snapshot: MatchSnapshot;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isPaused: boolean;
  onTogglePause: () => void;
};

export function Scoreboard({ snapshot, speed, setSpeed, isPaused, onTogglePause }: ScoreboardProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.scoreboard}>
      <TeamSummaryBlock side="home" team={snapshot.home} />
      <div className={styles.clockPanel}>
        <span className={styles.quarter}>{t(`match_broadcast.clock.quarters.${snapshot.quarter}`)}</span>
        <strong className={styles.gameClock}>{snapshot.gameClock}</strong>
        <span className={styles.shotClock}>
          {t('match_broadcast.clock.shot_clock')} <b>{snapshot.shotClock}</b>
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
        <Button variant="outline" onClick={onTogglePause}>
          {isPaused ? t('match_broadcast.clock.resume') : t('match_broadcast.clock.pause')}
        </Button>
      </div>
      <TeamSummaryBlock side="away" team={snapshot.away} />
    </section>
  );
}
