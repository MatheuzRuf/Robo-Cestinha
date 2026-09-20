import type { BallTrajectory, Frame } from '../../../../types/game';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player } from './Player';
import { gameToSvg } from '../../../../config/court';
import trajectoryStyles from './Ball.module.css';
import { startTransition, useEffect, useRef, useState } from 'react';

interface CourtStageProps {
  frame: Frame | null;
  transitionDurationMs: number;
}

export function CourtStage({ frame, transitionDurationMs }: CourtStageProps) {
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

  return (
    <div className={styles.stage}>
      <svg viewBox="0 0 940 500" role="img" aria-label="Animated basketball court">
        <Court />
        {start && end ? (
          <line x1={start.cx} y1={start.cy} x2={end.cx} y2={end.cy} className={trajectoryStyles.trajectory} />
        ) : null}
        {frame?.players.map((player) => (
          <Player key={player.id} player={player} transitionDuration={transitionDuration} />
        ))}
        {frame ? <Ball ball={frame.ball} transitionDuration={transitionDuration} /> : null}
      </svg>
    </div>
  );
}
