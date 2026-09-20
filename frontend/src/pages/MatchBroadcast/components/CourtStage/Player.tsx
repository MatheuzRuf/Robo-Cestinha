import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { PlayerState } from '../../../../types/game';
import { gameToSvg } from '../../../../config/court';
import { TEAM_COLORS, PLAYER_RADIUS } from '../../../../config/teams';
import styles from './Player.module.css';

export function Player({ player, transitionDuration }: { player: PlayerState; transitionDuration: number }) {
  const { cx, cy } = gameToSvg(player.x ?? 0, player.y ?? 0);
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
