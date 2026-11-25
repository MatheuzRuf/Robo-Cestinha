import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { BallState } from '../../../../types/game';
import { gameToSvg, SCALE } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 15, y: 10 };

export function Ball({
  ball,
  transitionDuration,
  isHeld = false,
}: {
  ball: BallState;
  transitionDuration: number;
  isHeld?: boolean;
}) {
  const { cx, cy } = gameToSvg(ball.x, ball.y);
  const targetX = isHeld ? cx + HELD_BALL_OFFSET.x : cx;
  const targetY = isHeld ? cy + HELD_BALL_OFFSET.y : cy - (ball.height ?? 0) * SCALE;

  return (
    <motion.circle
      r={BALL_RADIUS}
      className={`${styles.ball} ${isHeld ? styles.held : ''}`.trim()}
      style={style}
      animate={{ cx: targetX, cy: targetY }}
      transition={{ duration: transitionDuration, ease: 'linear' }}
    />
  );
}
