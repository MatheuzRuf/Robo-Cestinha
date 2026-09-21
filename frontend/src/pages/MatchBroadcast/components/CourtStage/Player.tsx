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
    <>
      <motion.circle
        r={PLAYER_RADIUS}
        className={styles.player}
        style={style}
        animate={{ cx, cy }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      />
      <motion.circle
        r={PLAYER_RADIUS + 3}
        className={styles.playerRing}
        animate={{ cx, cy }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      />
      <motion.text
        textAnchor="middle"
        className={styles.number}
        animate={{ x: cx, y: cy + 4 }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      >
        {player.number}
      </motion.text>
      <motion.rect
        className={styles.labelBackground}
        width={68}
        height={15}
        rx={3}
        animate={{ x: cx - 34, y: cy + PLAYER_RADIUS + 7 }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      />
      <motion.text
        textAnchor="middle"
        className={styles.labelText}
        animate={{ x: cx, y: cy + PLAYER_RADIUS + 18 }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      >
        {player.name.toUpperCase()} #{player.number}
      </motion.text>
    </>
  );
}
