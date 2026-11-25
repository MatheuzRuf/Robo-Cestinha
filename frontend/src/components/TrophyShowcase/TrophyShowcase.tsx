import { motion } from 'framer-motion';
import { Crosshair, Flame, Layers, Shield, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { useTranslation } from '../../lib/i18n/i18n';
import { NbaImage } from '../NbaImage';
import type { MatchTrophy, TrophyId, TrophyTier } from '../../pages/MatchStats/stats';
import styles from './TrophyShowcase.module.css';

const TROPHY_ICONS: Record<TrophyId, LucideIcon> = {
  mvp: Trophy,
  top_scorer: Flame,
  sharpshooter: Crosshair,
  playmaker: Sparkles,
  glass_cleaner: Layers,
  defensive_anchor: Shield,
};

const TIER_CLASSES: Record<TrophyTier, string> = {
  gold: styles.tierGold,
  silver: styles.tierSilver,
  bronze: styles.tierBronze,
};

interface TrophyShowcaseProps {
  trophies: MatchTrophy[];
  variant?: 'compact' | 'full';
}

function TrophyCard({ trophy, variant, index }: { trophy: MatchTrophy; variant: 'compact' | 'full'; index: number }) {
  const { t } = useTranslation();
  const Icon = TROPHY_ICONS[trophy.id];
  const isMvp = trophy.id === 'mvp';

  return (
    <motion.article
      className={`${styles.card} ${TIER_CLASSES[trophy.tier]} ${isMvp ? styles.mvpCard : ''} ${
        variant === 'compact' ? styles.compactCard : ''
      }`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.06, 0.36) }}
    >
      <header className={styles.cardHeader}>
        <span className={styles.iconWrap}>
          <Icon size={isMvp ? 22 : 16} aria-hidden="true" />
        </span>
        <div className={styles.cardTitles}>
          <h3>{t(`trophies.${trophy.id}`)}</h3>
          {variant === 'full' ? <p>{t(`trophies.${trophy.id}_desc`)}</p> : null}
        </div>
      </header>

      <div className={styles.player}>
        <NbaImage
          kind="player"
          nbaId={trophy.player.nbaPlayerId}
          alt=""
          fallback={trophy.player.name}
          size="profile"
          className={styles.portrait}
        />
        <div className={styles.playerCopy}>
          <strong>{trophy.player.name}</strong>
          <span className={styles.teamBadge}>{trophy.team.abbreviation}</span>
        </div>
      </div>

      <div className={styles.value}>
        <strong>{trophy.headlineValue}</strong>
        <span>{trophy.supportingStats.join(' · ')}</span>
      </div>
    </motion.article>
  );
}

export function TrophyShowcase({ trophies, variant = 'full' }: TrophyShowcaseProps) {
  if (!trophies.length) return null;

  if (variant === 'compact') {
    return (
      <div className={styles.compactStrip}>
        {trophies.map((trophy, index) => (
          <TrophyCard key={trophy.id} trophy={trophy} variant="compact" index={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.fullGrid}>
      {trophies.map((trophy, index) => (
        <TrophyCard key={trophy.id} trophy={trophy} variant="full" index={index} />
      ))}
    </div>
  );
}
