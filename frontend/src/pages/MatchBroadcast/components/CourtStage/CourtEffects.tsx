import type { CSSProperties } from 'react';
import { COURT_HEIGHT_FT, COURT_WIDTH_FT, HOOP_DISTANCE_FROM_BASELINE_FT, ft } from '../../../../config/court';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from './CourtEffects.module.css';

export type HoopSide = 'left' | 'right';
export type TeamSide = 'home' | 'away';

export interface EffectPosition {
  x: number;
  y: number;
}

export interface ScoreEffect {
  kind: 'score';
  sequence: number;
  points: 2 | 3;
  hoopSide: HoopSide;
  teamSide: TeamSide;
  shooterId: string | null;
  shooterName: string;
  shooterPos: EffectPosition | null;
  teamAbbreviation: string;
}

export interface ReboundEffect {
  kind: 'rebound';
  sequence: number;
  reboundType: 'offensive' | 'defensive';
  teamSide: TeamSide;
  playerId: string | null;
  playerName: string;
  playerPos: EffectPosition | null;
  hoopSide: HoopSide;
  teamAbbreviation: string;
}

export interface MissEffect {
  kind: 'miss';
  sequence: number;
  hoopSide: HoopSide;
}

export type FrameEffect = ScoreEffect | ReboundEffect | MissEffect;

const SCALE = 10;
const COURT_MID_Y = ft(COURT_HEIGHT_FT) / 2;
const HOOP_LEFT_X = ft(HOOP_DISTANCE_FROM_BASELINE_FT);
const HOOP_RIGHT_X = ft(COURT_WIDTH_FT) - HOOP_LEFT_X;

function hoopX(side: HoopSide) {
  return side === 'left' ? HOOP_LEFT_X : HOOP_RIGHT_X;
}

function hoopPoint(side: HoopSide) {
  return { x: hoopX(side), y: COURT_MID_Y };
}

function toSvg(position: EffectPosition) {
  return { x: position.x * SCALE, y: position.y * SCALE };
}

function ScoreBurst({
  effect,
  hoop,
  shooter,
}: {
  effect: ScoreEffect;
  hoop: EffectPosition;
  shooter: EffectPosition | null;
}) {
  const isThree = effect.points === 3;
  const rayCount = isThree ? 12 : 8;
  const rayLength = isThree ? 34 : 24;
  const color = isThree ? 'var(--color-effect-score-3pt)' : 'var(--color-effect-score-2pt)';
  const style = { '--effect-color': color } as CSSProperties;

  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      {shooter ? <circle cx={shooter.x} cy={shooter.y} r={22} className={styles.scorerHalo} /> : null}
      <circle cx={hoop.x} cy={hoop.y} r={9} className={styles.shockwave} />
      {isThree ? (
        <circle cx={hoop.x} cy={hoop.y} r={7} className={`${styles.shockwave} ${styles.shockwaveInner}`} />
      ) : null}
      {Array.from({ length: rayCount }, (_, index) => {
        const angle = (360 / rayCount) * index;
        return (
          <line
            key={`ray-${index}`}
            x1={hoop.x}
            y1={hoop.y}
            x2={hoop.x + rayLength}
            y2={hoop.y}
            className={styles.spark}
            style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${hoop.x}px ${hoop.y}px` }}
          />
        );
      })}
      <text x={hoop.x} y={hoop.y - 16} textAnchor="middle" className={styles.calloutText}>
        {isThree ? '3PT +3' : '+2'}
      </text>
    </g>
  );
}

function ReboundPulse({ effect }: { effect: ReboundEffect }) {
  const rim = hoopPoint(effect.hoopSide);
  const target = effect.playerPos ? toSvg(effect.playerPos) : rim;
  const isOffensive = effect.reboundType === 'offensive';
  const color = isOffensive ? 'var(--color-effect-rebound-off)' : 'var(--color-effect-rebound-def)';
  const style = { '--effect-color': color } as CSSProperties;
  const midX = (rim.x + target.x) / 2;
  const midY = Math.min(rim.y, target.y) - 34;

  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      <path d={`M ${rim.x} ${rim.y} Q ${midX} ${midY} ${target.x} ${target.y}`} className={styles.reboundArc} />
      <circle cx={target.x} cy={target.y} r={20} className={styles.shockwave} />
      <circle cx={target.x} cy={target.y} r={12} className={`${styles.shockwave} ${styles.shockwaveInner}`} />
      <text x={target.x} y={target.y - 30} textAnchor="middle" className={styles.calloutText}>
        {isOffensive ? 'OREB' : 'DREB'}
      </text>
    </g>
  );
}

function MissFlash({ hoopSide }: { hoopSide: HoopSide }) {
  const rim = hoopPoint(hoopSide);
  return (
    <g className={styles.effectLayer} aria-hidden="true">
      <circle cx={rim.x} cy={rim.y} r={6} className={styles.missFlash} />
    </g>
  );
}

export function CourtEffectsSvg({ effects }: { effects: FrameEffect[] }) {
  return (
    <>
      {effects.map((effect) => {
        if (effect.kind === 'score') {
          return (
            <ScoreBurst
              key={`score-${effect.sequence}`}
              effect={effect}
              hoop={hoopPoint(effect.hoopSide)}
              shooter={effect.shooterPos ? toSvg(effect.shooterPos) : null}
            />
          );
        }
        if (effect.kind === 'rebound') {
          return <ReboundPulse key={`rebound-${effect.sequence}`} effect={effect} />;
        }
        return <MissFlash key={`miss-${effect.sequence}`} hoopSide={effect.hoopSide} />;
      })}
    </>
  );
}

interface EffectBannerCopy {
  key: string;
  text: string;
  tone: 'score' | 'three' | 'oreb' | 'dreb' | 'miss';
}

export function describeEffect(
  effect: FrameEffect,
  t: (key: string, values?: Record<string, string | number>) => string,
): EffectBannerCopy {
  if (effect.kind === 'score') {
    const key = effect.points === 3 ? 'score_3pt' : 'score_2pt';
    return {
      key: `${key}-${effect.sequence}`,
      text: t(`match_broadcast.effects.${key}`, { player: effect.shooterName }),
      tone: effect.points === 3 ? 'three' : 'score',
    };
  }
  if (effect.kind === 'rebound') {
    const key = effect.reboundType === 'offensive' ? 'rebound_off' : 'rebound_def';
    const teamKey = effect.reboundType === 'offensive' ? 'rebound_off_team' : 'rebound_def_team';
    return {
      key: `${key}-${effect.sequence}`,
      text: effect.playerName
        ? t(`match_broadcast.effects.${key}`, { player: effect.playerName })
        : t(`match_broadcast.effects.${teamKey}`, { team: effect.teamAbbreviation }),
      tone: effect.reboundType === 'offensive' ? 'oreb' : 'dreb',
    };
  }
  return { key: `miss-${effect.sequence}`, text: t('match_broadcast.effects.missed'), tone: 'miss' };
}

export function CourtEffectBanner({ effect, durationMs }: { effect: FrameEffect; durationMs: number }) {
  const { t } = useTranslation();
  const copy = describeEffect(effect, t);
  const toneClass = {
    score: styles.bannerScore,
    three: styles.bannerThree,
    oreb: styles.bannerOreb,
    dreb: styles.bannerDreb,
    miss: styles.bannerMiss,
  }[copy.tone];

  return (
    <div
      key={copy.key}
      className={`${styles.banner} ${toneClass}`.trim()}
      style={{ '--banner-duration': `${Math.max(700, Math.round(durationMs * 1.1))}ms` } as CSSProperties}
      role="status"
    >
      {copy.text}
    </div>
  );
}
