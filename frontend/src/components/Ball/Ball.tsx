import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import styles from './Ball.module.css';
import type { BallState } from '../../types/game';
import { gameToSvg } from '../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../config/teams';

interface Props {
  ball: BallState;
  transitionDuration: number;
}

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

export function Ball({ ball, transitionDuration }: Props) {
  const safeX = ball.x != null ? ball.x : 0;
  const safeY = ball.y != null ? ball.y : 0;
  const { cx, cy } = gameToSvg(safeX, safeY);

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