import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { BallState } from '../../../../types/game';
import { gameToSvg } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

export function Ball({ ball, transitionDuration }: { ball: BallState; transitionDuration: number }) {
  const { cx, cy } = gameToSvg(ball.x ?? 0, ball.y ?? 0);
  return (
    <motion.circle
      r={BALL_RADIUS}
      className={styles.ball}
      style={style}
      animate={{ cx, cy }}
      transition={{ duration: transitionDuration, ease: 'linear' }}
    />
  );
}
