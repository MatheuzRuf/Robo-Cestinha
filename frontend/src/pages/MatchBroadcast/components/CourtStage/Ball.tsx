import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { BallState } from '../../../../types/game';
import { gameToSvg, SCALE } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

export function Ball({ ball, transitionDuration }: { ball: BallState; transitionDuration: number }) {
  const { cx, cy } = gameToSvg(ball.x, ball.y);
  return (
    <motion.circle
      r={BALL_RADIUS}
      className={styles.ball}
      style={style}
      animate={{ cx, cy: cy - (ball.height ?? 0) * SCALE }}
      transition={{ duration: transitionDuration, ease: 'linear' }}
    />
  );
}
