import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import styles from './Player.module.css';
import type { PlayerState } from '../../types/game';
import { gameToSvg } from '../../config/court';
import { TEAM_COLORS, PLAYER_RADIUS } from '../../config/teams';

interface Props {
  player: PlayerState;
  transitionDuration: number; // seconds
}

export function Player({ player, transitionDuration }: Props) {
  const safeX = player.x != null ? player.x : 0;
  const safeY = player.y != null ? player.y : 0;
  const { cx, cy } = gameToSvg(safeX, safeY);
  const style = { '--team-color': TEAM_COLORS[player.team] } as CSSProperties;

  return (
    <motion.circle
      r={PLAYER_RADIUS}
      className={styles.player}
      style={style}
      animate={{ cx, cy }}
      transition={{ duration: transitionDuration, ease: 'linear' }}
    />
  );
}