import { motion } from 'framer-motion';
import { useId, useState, type CSSProperties } from 'react';
import type { PlayerState } from '../../../../types/game';
import { gameToSvg } from '../../../../config/court';
import { TEAM_COLORS, PLAYER_RADIUS } from '../../../../config/teams';
import { getNbaPlayerHeadshotUrl } from '../../../../lib/nbaImages';
import styles from './Player.module.css';

export function Player({ player, transitionDuration }: { player: PlayerState; transitionDuration: number }) {
  const { cx, cy } = gameToSvg(player.x ?? 0, player.y ?? 0);
  const nameParts = player.name.trim().split(/\s+/);
  const shortName =
    nameParts.length > 1 ? `${nameParts[0].charAt(0)}. ${nameParts[nameParts.length - 1]}` : player.name.trim();
  const imageUrl = getNbaPlayerHeadshotUrl(player.nbaPlayerId);
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = imageUrl !== null && !imageFailed;
  const patternId = `player-headshot-${useId().replace(/:/g, '')}`;
  const style = {
    '--team-color': TEAM_COLORS[player.team],
    ...(hasImage ? { fill: `url(#${patternId})` } : {}),
  } as CSSProperties;

  return (
    <>
      {hasImage ? (
        <defs>
          <pattern
            id={patternId}
            width="1"
            height="1"
            patternUnits="objectBoundingBox"
            patternContentUnits="objectBoundingBox"
          >
            <rect width="1" height="1" fill={TEAM_COLORS[player.team]} />
            <image
              href={imageUrl}
              width="1"
              height="1"
              preserveAspectRatio="xMidYMid slice"
              onError={() => setImageFailed(true)}
            />
          </pattern>
        </defs>
      ) : null}
      <motion.circle
        r={PLAYER_RADIUS}
        className={styles.player}
        style={style}
        animate={{ cx, cy }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      />
      {!hasImage ? (
        <motion.text
          textAnchor="middle"
          className={styles.number}
          animate={{ x: cx, y: cy + 4 }}
          transition={{ duration: transitionDuration, ease: 'linear' }}
        >
          {player.number ?? player.position}
        </motion.text>
      ) : null}
      <motion.circle
        r={PLAYER_RADIUS + 3}
        className={styles.playerRing}
        animate={{ cx, cy }}
        transition={{ duration: transitionDuration, ease: 'linear' }}
      />
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
        {shortName.toUpperCase()}
      </motion.text>
    </>
  );
}
