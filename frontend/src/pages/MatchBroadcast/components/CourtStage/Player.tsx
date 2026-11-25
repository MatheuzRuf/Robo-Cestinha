import { motion } from 'framer-motion';
import { useId, useState, type CSSProperties } from 'react';
import type { PlayerState } from '../../../../types/game';
import { gameToSvg } from '../../../../config/court';
import { TEAM_COLORS, PLAYER_RADIUS } from '../../../../config/teams';
import { getNbaPlayerHeadshotUrl } from '../../../../lib/nbaImages';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from './Player.module.css';

export type StaminaTier = 'high' | 'mid' | 'low';

export interface StaminaStatus {
  tier: StaminaTier;
  color: string;
  value: number;
  percent: number;
}

const STAMINA_HIGH_THRESHOLD = 0.65;
const STAMINA_MID_THRESHOLD = 0.4;
const STAMINA_BAR_WIDTH = 70;

/**
 * Resolve the stamina tier used by both the gauge bar and the court legend.
 * The mid/low boundary matches the engine's shooting-penalty threshold (0.40).
 */
export function getStaminaStatus(stamina?: number): StaminaStatus | null {
  if (stamina === undefined || stamina === null || !Number.isFinite(stamina)) return null;

  const value = Math.max(0, Math.min(1, stamina));
  const percent = Math.round(value * 100);
  if (value >= STAMINA_HIGH_THRESHOLD) {
    return { tier: 'high', color: 'var(--color-stamina-high)', value, percent };
  }
  if (value >= STAMINA_MID_THRESHOLD) {
    return { tier: 'mid', color: 'var(--color-stamina-mid)', value, percent };
  }
  return { tier: 'low', color: 'var(--color-stamina-low)', value, percent };
}

export const STAMINA_LEGEND_TIERS: { tier: StaminaTier; color: string; range: string }[] = [
  { tier: 'high', color: 'var(--color-stamina-high)', range: '65-100%' },
  { tier: 'mid', color: 'var(--color-stamina-mid)', range: '40-64%' },
  { tier: 'low', color: 'var(--color-stamina-low)', range: '0-39%' },
];

export function Player({ player, transitionDuration }: { player: PlayerState; transitionDuration: number }) {
  const { t } = useTranslation();
  const { cx, cy } = gameToSvg(player.x ?? 0, player.y ?? 0);
  const nameParts = player.name.trim().split(/\s+/);
  const shortName =
    nameParts.length > 1 ? `${nameParts[0].charAt(0)}. ${nameParts[nameParts.length - 1]}` : player.name.trim();
  const imageUrl = getNbaPlayerHeadshotUrl(player.nbaPlayerId);
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = imageUrl !== null && !imageFailed;
  const patternId = `player-headshot-${useId().replace(/:/g, '')}`;
  const groupStyle = { '--team-color': TEAM_COLORS[player.team] } as CSSProperties;
  const headshotStyle = hasImage ? ({ fill: `url(#${patternId})` } as CSSProperties) : undefined;

  const stamina = getStaminaStatus(player.stamina);
  const staminaWidth = stamina ? Math.max(4, STAMINA_BAR_WIDTH * stamina.value) : 0;
  const plateTop = cy + PLAYER_RADIUS + 7;
  const barTop = plateTop + 15;

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
      <g className={styles.playerGroup} style={groupStyle}>
        <title>
          {stamina
            ? t('match_broadcast.stamina.player_tooltip', { player: player.name, percent: stamina.percent })
            : player.name}
        </title>
        <motion.circle
          r={PLAYER_RADIUS}
          className={styles.player}
          style={headshotStyle}
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
        {stamina?.tier === 'low' ? (
          <motion.circle
            r={PLAYER_RADIUS + 6}
            className={styles.lowStaminaPulse}
            animate={{ cx, cy }}
            transition={{ duration: transitionDuration, ease: 'linear' }}
          />
        ) : null}
        <motion.rect
          className={styles.labelBackground}
          width={78}
          height={21}
          rx={4}
          animate={{ x: cx - 39, y: plateTop }}
          transition={{ duration: transitionDuration, ease: 'linear' }}
        />
        <motion.text
          textAnchor="middle"
          className={styles.labelText}
          animate={{ x: cx, y: plateTop + 12 }}
          transition={{ duration: transitionDuration, ease: 'linear' }}
        >
          {shortName.toUpperCase()}
        </motion.text>
        {stamina ? (
          <>
            <motion.rect
              className={styles.staminaTrack}
              width={STAMINA_BAR_WIDTH}
              height={3.5}
              rx={1.75}
              animate={{ x: cx - STAMINA_BAR_WIDTH / 2, y: barTop }}
              transition={{ duration: transitionDuration, ease: 'linear' }}
            />
            <motion.rect
              width={staminaWidth}
              height={3.5}
              rx={1.75}
              fill={stamina.color}
              animate={{ x: cx - STAMINA_BAR_WIDTH / 2, y: barTop, width: staminaWidth }}
              transition={{ duration: transitionDuration, ease: 'linear' }}
            />
          </>
        ) : null}
      </g>
    </>
  );
}
