import type { Frame } from '../../../../types/game';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player } from './Player';
import { gameToSvg } from '../../../../config/court';
import trajectoryStyles from './Ball.module.css';
import { useEffect, useRef } from 'react';

interface CourtStageProps {
  frame: Frame | null;
  transitionDurationMs: number;
}

export function CourtStage({ frame, transitionDurationMs }: CourtStageProps) {
  const transitionDuration = transitionDurationMs / 1000;
  const previousBallRef = useRef(frame?.ball ?? null);
  const previousBall = previousBallRef.current;

  useEffect(() => {
    if (frame) previousBallRef.current = frame.ball;
  }, [frame]);

  const start = previousBall && frame ? gameToSvg(previousBall.x, previousBall.y) : null;
  const end = frame ? gameToSvg(frame.ball.x, frame.ball.y) : null;
  const isMoving = start && end && (start.cx !== end.cx || start.cy !== end.cy);

  return (
    <div className={styles.stage}>
      <svg viewBox="0 0 940 500" role="img" aria-label="Animated basketball court">
        <Court />
        {isMoving ? (
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
