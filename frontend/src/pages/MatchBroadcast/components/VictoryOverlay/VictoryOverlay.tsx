import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { NbaImage } from '../../../../components/NbaImage';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { SimulationTeam } from '../../../../types/matchBroadcast';
import styles from './VictoryOverlay.module.css';

interface VictoryOverlayProps {
  homeTeam: SimulationTeam;
  awayTeam: SimulationTeam;
  homeScore: number;
  awayScore: number;
  winnerTeamId: string | null;
  isOvertime: boolean;
  trophiesSlot?: ReactNode;
  onViewStats: () => void;
  onReplay: () => void;
  onBackToBracket: () => void;
  onDismiss: () => void;
}

const CONFETTI_PIECES = 36;

function confettiPiece(index: number) {
  const random = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };
  const left = random(index + 1) * 100;
  const delay = random(index + 11) * 700;
  const duration = 1800 + random(index + 21) * 1200;
  const drift = (random(index + 31) - 0.5) * 90;
  const rotation = random(index + 41) * 360;
  const size = 6 + random(index + 51) * 7;
  const palette = ['var(--color-trophy-gold)', 'var(--color-primary)', 'var(--color-overlay-text)'];
  const color = palette[index % palette.length];

  return {
    left,
    delay,
    duration,
    drift,
    rotation,
    size,
    color,
  };
}

export function VictoryOverlay({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  winnerTeamId,
  isOvertime,
  trophiesSlot,
  onViewStats,
  onReplay,
  onBackToBracket,
  onDismiss,
}: VictoryOverlayProps) {
  const { t } = useTranslation();
  const winnerTeam =
    winnerTeamId === awayTeam.teamId || (winnerTeamId === null && awayScore > homeScore) ? awayTeam : homeTeam;
  const confetti = useMemo(() => Array.from({ length: CONFETTI_PIECES }, (_, index) => confettiPiece(index)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="false"
      aria-label={t('match_broadcast.victory.eyebrow')}
    >
      <div className={styles.confettiLayer} aria-hidden="true">
        {confetti.map((piece, index) => (
          <span
            key={index}
            className={styles.confetti}
            style={
              {
                left: `${piece.left}%`,
                width: `${piece.size}px`,
                height: `${piece.size * 1.6}px`,
                background: piece.color,
                animationDelay: `${piece.delay}ms`,
                animationDuration: `${piece.duration}ms`,
                '--confetti-drift': `${piece.drift}px`,
                '--confetti-rotation': `${piece.rotation}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label={t('match_broadcast.victory.dismiss')}
      >
        <X size={18} aria-hidden="true" />
      </button>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
      >
        <div className={styles.crest}>
          <span className={styles.spotlight} aria-hidden="true" />
          <Trophy className={styles.trophyIcon} size={40} aria-hidden="true" />
          <NbaImage
            kind="team"
            nbaId={winnerTeam.nbaTeamId}
            alt={`${winnerTeam.name} logo`}
            fallback={winnerTeam.abbreviation}
            className={styles.winnerLogo}
          />
        </div>

        <span className={styles.eyebrow}>
          {t(isOvertime ? 'match_broadcast.victory.eyebrow_ot' : 'match_broadcast.victory.eyebrow')}
        </span>
        <h2 className={styles.headline}>{t('match_broadcast.victory.winner_headline', { team: winnerTeam.name })}</h2>
        <div className={styles.finalScore}>
          <span className={styles.finalScoreTeam}>{homeTeam.abbreviation}</span>
          <strong>
            {homeScore} — {awayScore}
          </strong>
          <span className={styles.finalScoreTeam}>{awayTeam.abbreviation}</span>
        </div>

        {trophiesSlot ? <div className={styles.trophies}>{trophiesSlot}</div> : null}

        <div className={styles.actions}>
          <Button variant="primary" onClick={onViewStats}>
            {t('match_broadcast.victory.view_stats')}
          </Button>
          <Button variant="outline" onClick={onReplay}>
            {t('match_broadcast.victory.replay')}
          </Button>
          <Button variant="outline" onClick={onBackToBracket}>
            {t('match_broadcast.victory.back_to_bracket')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
