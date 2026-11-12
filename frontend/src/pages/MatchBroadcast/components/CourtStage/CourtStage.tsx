import type { BallTrajectory, Frame } from '../../../../types/game';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player } from './Player';
import { gameToSvg } from '../../../../config/court';
import trajectoryStyles from './Ball.module.css';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/i18n';

interface CourtStageProps {
  frame: Frame | null;
  transitionDurationMs: number;
  basketMessage?: string;
  basketSequence?: number;
  madeBasketSide?: 'left' | 'right';
}

export function CourtStage({
  frame,
  transitionDurationMs,
  basketMessage,
  basketSequence,
  madeBasketSide,
}: CourtStageProps) {
  const { t } = useTranslation();
  const transitionDuration = transitionDurationMs / 1000;
  const [visibleTrajectory, setVisibleTrajectory] = useState<BallTrajectory | null>(null);
  const trajectoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!frame?.trajectory) return;

    startTransition(() => setVisibleTrajectory(frame.trajectory!));
    if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);

    trajectoryTimeoutRef.current = setTimeout(() => {
      startTransition(() => setVisibleTrajectory(null));
      trajectoryTimeoutRef.current = undefined;
    }, transitionDurationMs);
  }, [frame, transitionDurationMs]);

  useEffect(() => {
    return () => {
      if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);
    };
  }, []);

  const trajectory = visibleTrajectory;
  const start = trajectory ? gameToSvg(trajectory.from.x, trajectory.from.y) : null;
  const end = trajectory ? gameToSvg(trajectory.to.x, trajectory.to.y) : null;
  const trajectoryClass = trajectory
    ? trajectory.fromTeam !== trajectory.toTeam
      ? trajectoryStyles.opponentTrajectory
      : trajectoryStyles.sameTeamTrajectory
    : undefined;

  return (
    <div className={styles.stage}>
      <svg
        viewBox="-40 -36 1020 572"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('match_broadcast.simulation.court_label')}
      >
        <Court madeBasketSide={madeBasketSide} />
        {start && end ? (
          <line
            x1={start.cx}
            y1={start.cy}
            x2={end.cx}
            y2={end.cy}
            className={`${trajectoryStyles.trajectory} ${trajectoryClass ?? ''}`.trim()}
          />
        ) : null}
        {frame?.players.map((player) => (
          <Player key={player.id} player={player} transitionDuration={transitionDuration} />
        ))}
        {frame ? <Ball ball={frame.ball} transitionDuration={transitionDuration} /> : null}
      </svg>
      {basketMessage ? (
        <div className={styles.basketMessage} key={basketSequence} role="status">
          {basketMessage}
        </div>
      ) : null}
    </div>
  );
}
