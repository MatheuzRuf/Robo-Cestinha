import { useEffect, useRef, useState } from 'react';
import { CircleDot, Maximize, Minimize } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { NbaImage } from '../../../../components/NbaImage';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { SimulationTeam, Speed } from '../../../../types/matchBroadcast';
import styles from '../../MatchBroadcast.module.css';

const SCORE_DELTA_HOLD_MS = 900;
const MAX_ANIMATED_DELTA = 4;

function TeamSummaryBlock({
  side,
  team,
  score,
  hasPossession,
  delta,
}: {
  side: 'home' | 'away';
  team: SimulationTeam;
  score: number;
  hasPossession: boolean;
  delta: number | null;
}) {
  return (
    <div className={`${styles.teamSummary} ${hasPossession ? styles.hasPossession : ''} ${
      side === 'away' ? styles.awaySummary : ''
    }`.trim()}>
      <div className={styles.teamIdentity}>
        <NbaImage
          kind="team"
          nbaId={team.nbaTeamId}
          alt={`${team.name} logo`}
          fallback={team.abbreviation}
          className={styles.teamLogo}
        />
        <div className={styles.teamCopy}>
          <strong>{team.name}</strong>
          <span className={styles.teamMeta}>
            {hasPossession ? <CircleDot className={styles.possessionIcon} size={12} aria-hidden="true" /> : null}
            {team.abbreviation}
          </span>
        </div>
      </div>
      <span className={styles.scoreWrap}>
        {delta !== null ? (
          <span className={`${styles.scoreDelta} ${delta === 3 ? styles.scoreDeltaThree : ''}`.trim()} key={`${side}-${score}`}>
            +{delta}
          </span>
        ) : null}
        <strong className={`${styles.score} ${delta !== null ? styles.scorePop : ''}`}>{score}</strong>
      </span>
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
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isComplete: boolean;
  isPaused: boolean;
  isFullMode: boolean;
  onToggleFullMode: () => void;
};

export function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  possessionTeamId,
  frameNumber,
  speed,
  setSpeed,
  isComplete,
  isPaused,
  isFullMode,
  onToggleFullMode,
}: ScoreboardProps) {
  const { t } = useTranslation();
  const previous = useRef({ home: homeScore, away: awayScore, frame: frameNumber });
  const [deltas, setDeltas] = useState<{ home: number | null; away: number | null }>({
    home: null,
    away: null,
  });

  useEffect(() => {
    const snapshot = previous.current;
    const advancedOneFrame = frameNumber === snapshot.frame + 1;
    const homeDelta = homeScore - snapshot.home;
    const awayDelta = awayScore - snapshot.away;
    previous.current = { home: homeScore, away: awayScore, frame: frameNumber };

    const next = advancedOneFrame
      ? {
          home: homeDelta > 0 && homeDelta <= MAX_ANIMATED_DELTA ? homeDelta : null,
          away: awayDelta > 0 && awayDelta <= MAX_ANIMATED_DELTA ? awayDelta : null,
        }
      : { home: null, away: null };

    if (next.home === null && next.away === null) {
      setDeltas((current) => (current.home === null && current.away === null ? current : { home: null, away: null }));
      return;
    }

    setDeltas(next);
    const timeoutId = window.setTimeout(() => setDeltas({ home: null, away: null }), SCORE_DELTA_HOLD_MS);
    return () => window.clearTimeout(timeoutId);
  }, [awayScore, frameNumber, homeScore]);

  const statusTone: 'live' | 'paused' | 'final' = isComplete ? 'final' : isPaused ? 'paused' : 'live';
  const statusClass = statusTone === 'live' ? styles.statusLive : statusTone === 'paused' ? styles.statusPaused : styles.statusFinal;

  return (
    <section className={styles.scoreboard}>
      <TeamSummaryBlock
        side="home"
        team={homeTeam}
        score={homeScore}
        hasPossession={possessionTeamId === homeTeam.teamId}
        delta={deltas.home}
      />
      <div className={styles.clockPanel}>
        <span className={`${styles.statusBadge} ${statusClass}`.trim()}>
          {statusTone === 'live' ? <span className={styles.statusDot} aria-hidden="true" /> : null}
          <span>{t(`match_broadcast.clock.${statusTone}`)}</span>
        </span>
        <span className={styles.clockDivider} aria-hidden="true" />
        <SegmentedControl
          label={t('match_broadcast.clock.speed_short')}
          hideLabel
          layout="inline"
          size="sm"
          options={[
            { value: '1', label: '1×' },
            { value: '1.5', label: '1.5×' },
            { value: '2', label: '2×' },
          ]}
          value={String(speed)}
          onChange={(value) => setSpeed(Number(value) as Speed)}
        />
        <span className={styles.clockDivider} aria-hidden="true" />
        <Button
          variant="outline"
          size="sm"
          icon={isFullMode ? <Minimize size={14} aria-hidden="true" /> : <Maximize size={14} aria-hidden="true" />}
          onClick={onToggleFullMode}
        >
          {t(isFullMode ? 'match_broadcast.simulation.exit_full_mode' : 'match_broadcast.simulation.full_mode')}
        </Button>
      </div>
      <TeamSummaryBlock
        side="away"
        team={awayTeam}
        score={awayScore}
        hasPossession={possessionTeamId === awayTeam.teamId}
        delta={deltas.away}
      />
    </section>
  );
}