import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowUpCircle, CircleDot, Flame, Shield, Zap, type LucideIcon } from 'lucide-react';
import { gameToSvg, hoopPositionFt, type HoopSide } from '../../../../config/court';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from './CourtEffects.module.css';

export type { HoopSide };
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
  assistName: string | null;
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

export interface StealEffect {
  kind: 'steal';
  sequence: number;
  teamSide: TeamSide;
  defenderId: string | null;
  defenderName: string;
  defenderPos: EffectPosition | null;
  victimName: string;
  teamAbbreviation: string;
}

export interface InterceptEffect {
  kind: 'intercept';
  sequence: number;
  teamSide: TeamSide;
  defenderId: string | null;
  defenderName: string;
  defenderPos: EffectPosition | null;
  passerName: string;
  teamAbbreviation: string;
}

export interface FoulEffect {
  kind: 'foul';
  sequence: number;
  teamSide: TeamSide;
  playerId: string | null;
  playerName: string;
  playerPos: EffectPosition | null;
  defenderName: string | null;
  teamAbbreviation: string;
}

export type FrameEffect = ScoreEffect | ReboundEffect | MissEffect | StealEffect | InterceptEffect | FoulEffect;

function hoopPoint(side: HoopSide) {
  const pos = hoopPositionFt(side);
  const { cx, cy } = gameToSvg(pos.x, pos.y);
  return { x: cx, y: cy };
}

function toSvg(position: EffectPosition) {
  const { cx, cy } = gameToSvg(position.x, position.y);
  return { x: cx, y: cy };
}

function CalloutPill({
  x,
  y,
  label,
  color,
  delayMs = 0,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  delayMs?: number;
}) {
  const width = Math.max(36, label.length * 8 + 16);
  const style = { '--effect-color': color, '--impact-delay': `${delayMs}ms` } as CSSProperties;
  return (
    <g className={styles.calloutPill} style={style} aria-hidden="true">
      <rect x={x - width / 2} y={y - 11} width={width} height={20} rx={10} className={styles.calloutPillBg} />
      <text x={x} y={y + 3.6} textAnchor="middle" className={styles.calloutPillText}>
        {label}
      </text>
    </g>
  );
}

function ScoreBurst({
  effect,
  hoop,
  shooter,
  impactDelayMs,
}: {
  effect: ScoreEffect;
  hoop: EffectPosition;
  shooter: EffectPosition | null;
  impactDelayMs: number;
}) {
  const isThree = effect.points === 3;
  const rayCount = isThree ? 12 : 8;
  const rayLength = isThree ? 34 : 24;
  const color = isThree ? 'var(--color-effect-score-3pt)' : 'var(--color-effect-score-2pt)';
  const style = { '--effect-color': color, '--impact-delay': `${impactDelayMs}ms` } as CSSProperties;

  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      {isThree ? <circle cx={hoop.x} cy={hoop.y} r={20} className={styles.prestigeGlow} /> : null}
      {shooter ? <circle cx={shooter.x} cy={shooter.y} r={22} className={styles.scorerHalo} /> : null}
      {isThree ? (
        <circle cx={hoop.x} cy={hoop.y} r={9} className={`${styles.shockwave} ${styles.shockwaveOuter}`} />
      ) : (
        <circle cx={hoop.x} cy={hoop.y} r={9} className={styles.shockwave} />
      )}
      {isThree ? (
        <circle cx={hoop.x} cy={hoop.y} r={6.5} className={`${styles.shockwave} ${styles.shockwaveInner}`} />
      ) : null}
      {Array.from({ length: rayCount }, (_, index) => {
        const angle = (360 / rayCount) * index;
        return (
          <line
            key={`ray-${index}`}
            x1={hoop.x + 6}
            y1={hoop.y}
            x2={hoop.x + rayLength}
            y2={hoop.y}
            className={styles.spark}
            style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${hoop.x}px ${hoop.y}px` }}
          />
        );
      })}
      <CalloutPill x={hoop.x} y={hoop.y - 28} label={isThree ? '3PT +3' : '+2'} color={color} delayMs={impactDelayMs} />
    </g>
  );
}

function MissFlash({ hoopSide }: { hoopSide: HoopSide }) {
  const rim = hoopPoint(hoopSide);
  const ticks = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  return (
    <g className={styles.effectLayer} aria-hidden="true">
      <circle cx={rim.x} cy={rim.y} r={6} className={styles.missFlash} />
      {ticks.map(([dx, dy], index) => (
        <line
          key={`tick-${index}`}
          x1={rim.x + dx * 8}
          y1={rim.y + dy * 8}
          x2={rim.x + dx * 13}
          y2={rim.y + dy * 13}
          className={styles.missTick}
        />
      ))}
    </g>
  );
}

function ReboundPulse({ effect, catchDelayMs }: { effect: ReboundEffect; catchDelayMs: number }) {
  const rim = hoopPoint(effect.hoopSide);
  const target = effect.playerPos ? toSvg(effect.playerPos) : rim;
  const isOffensive = effect.reboundType === 'offensive';
  const color = isOffensive ? 'var(--color-effect-rebound-off)' : 'var(--color-effect-rebound-def)';
  const style = { '--effect-color': color, '--impact-delay': `${catchDelayMs}ms` } as CSSProperties;
  const midX = (rim.x + target.x) / 2;
  const midY = Math.min(rim.y, target.y) - 34;

  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      <path d={`M ${rim.x} ${rim.y} Q ${midX} ${midY} ${target.x} ${target.y}`} className={styles.reboundArc} />
      <circle cx={target.x} cy={target.y} r={20} className={styles.shockwave} />
      <circle cx={target.x} cy={target.y} r={12} className={`${styles.shockwave} ${styles.shockwaveInner}`} />
      <CalloutPill x={target.x} y={target.y - 34} label={isOffensive ? 'OREB' : 'DREB'} color={color} delayMs={catchDelayMs} />
    </g>
  );
}

function StealPulse({ effect, delayMs }: { effect: StealEffect; delayMs: number }) {
  const center = effect.defenderPos ? toSvg(effect.defenderPos) : null;
  if (!center) return null;
  const style = { '--effect-color': 'var(--color-effect-steal)', '--impact-delay': `${delayMs}ms` } as CSSProperties;
  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      <circle cx={center.x} cy={center.y} r={16} className={styles.shockwave} />
      <circle cx={center.x} cy={center.y} r={26} className={styles.softPulse} />
      <CalloutPill x={center.x} y={center.y - 26} label="STL" color="var(--color-effect-steal)" delayMs={delayMs} />
    </g>
  );
}

function InterceptPulse({ effect, delayMs }: { effect: InterceptEffect; delayMs: number }) {
  const center = effect.defenderPos ? toSvg(effect.defenderPos) : null;
  if (!center) return null;
  const style = { '--effect-color': 'var(--color-effect-intercept)', '--impact-delay': `${delayMs}ms` } as CSSProperties;
  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      <circle cx={center.x} cy={center.y} r={16} className={styles.shockwave} />
      <circle cx={center.x} cy={center.y} r={26} className={styles.softPulse} />
      <CalloutPill x={center.x} y={center.y - 26} label="INT" color="var(--color-effect-intercept)" delayMs={delayMs} />
    </g>
  );
}

function FoulPulse({ effect, delayMs }: { effect: FoulEffect; delayMs: number }) {
  const center = effect.playerPos ? toSvg(effect.playerPos) : null;
  if (!center) return null;
  const style = { '--effect-color': 'var(--color-effect-foul)', '--impact-delay': `${delayMs}ms` } as CSSProperties;
  return (
    <g className={styles.effectLayer} style={style} aria-hidden="true">
      <circle cx={center.x} cy={center.y} r={16} className={styles.foulRing} />
      <CalloutPill x={center.x} y={center.y - 24} label="FOUL" color="var(--color-effect-foul)" delayMs={delayMs} />
    </g>
  );
}

export function CourtEffectsSvg({
  effects,
  rimImpactDelayMs = 0,
  reboundCatchDelayMs = 0,
}: {
  effects: FrameEffect[];
  rimImpactDelayMs?: number;
  reboundCatchDelayMs?: number;
}) {
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
              impactDelayMs={rimImpactDelayMs}
            />
          );
        }
        if (effect.kind === 'rebound') {
          return <ReboundPulse key={`rebound-${effect.sequence}`} effect={effect} catchDelayMs={reboundCatchDelayMs} />;
        }
        if (effect.kind === 'miss') {
          return <MissFlash key={`miss-${effect.sequence}`} hoopSide={effect.hoopSide} />;
        }
        if (effect.kind === 'steal') {
          return <StealPulse key={`steal-${effect.sequence}`} effect={effect} delayMs={rimImpactDelayMs} />;
        }
        if (effect.kind === 'intercept') {
          return <InterceptPulse key={`intercept-${effect.sequence}`} effect={effect} delayMs={rimImpactDelayMs} />;
        }
        return <FoulPulse key={`foul-${effect.sequence}`} effect={effect} delayMs={rimImpactDelayMs} />;
      })}
    </>
  );
}

interface EffectBannerCopy {
  key: string;
  tag: string;
  player: string;
  assist?: string | null;
  tone: 'three' | 'score' | 'oreb' | 'dreb' | 'steal' | 'intercept' | 'foul' | 'miss';
  Icon: LucideIcon;
}

export function describeEffect(
  effect: FrameEffect,
  t: (key: string, values?: Record<string, string | number>) => string,
): EffectBannerCopy {
  if (effect.kind === 'score') {
    const three = effect.points === 3;
    return {
      key: `score-${effect.sequence}`,
      tag: t(three ? 'match_broadcast.effects.tag_3pt' : 'match_broadcast.effects.tag_2pt'),
      player: effect.shooterName,
      assist: effect.assistName,
      tone: three ? 'three' : 'score',
      Icon: three ? Flame : CircleDot,
    };
  }
  if (effect.kind === 'rebound') {
    const off = effect.reboundType === 'offensive';
    return {
      key: `rebound-${effect.sequence}`,
      tag: t(off ? 'match_broadcast.effects.tag_oreb' : 'match_broadcast.effects.tag_dreb'),
      player: effect.playerName,
      tone: off ? 'oreb' : 'dreb',
      Icon: off ? ArrowUpCircle : Shield,
    };
  }
  if (effect.kind === 'steal') {
    return {
      key: `steal-${effect.sequence}`,
      tag: t('match_broadcast.effects.tag_steal'),
      player: effect.defenderName,
      tone: 'steal',
      Icon: Zap,
    };
  }
  if (effect.kind === 'intercept') {
    return {
      key: `intercept-${effect.sequence}`,
      tag: t('match_broadcast.effects.tag_intercept'),
      player: effect.defenderName,
      tone: 'intercept',
      Icon: Zap,
    };
  }
  if (effect.kind === 'foul') {
    return {
      key: `foul-${effect.sequence}`,
      tag: t('match_broadcast.effects.tag_foul'),
      player: effect.playerName,
      tone: 'foul',
      Icon: AlertTriangle,
    };
  }
  return { key: `miss-${effect.sequence}`, tag: t('match_broadcast.effects.missed'), player: '', tone: 'miss', Icon: CircleDot };
}

export function CourtEffectBanner({ effect, durationMs }: { effect: FrameEffect; durationMs: number }) {
  const { t } = useTranslation();
  const copy = describeEffect(effect, t);
  const toneClass = {
    three: styles.bannerThree,
    score: styles.bannerScore,
    oreb: styles.bannerOreb,
    dreb: styles.bannerDreb,
    steal: styles.bannerSteal,
    intercept: styles.bannerIntercept,
    foul: styles.bannerFoul,
    miss: styles.bannerMiss,
  }[copy.tone];
  const Icon = copy.Icon;

  return (
    <div
      key={copy.key}
      className={`${styles.banner} ${toneClass}`.trim()}
      style={{ '--banner-duration': `${Math.max(700, Math.round(durationMs * 1.1))}ms` } as CSSProperties}
      role="status"
    >
      <span className={styles.bannerIcon}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className={styles.bannerTag}>{copy.tag}</span>
      {copy.player ? <span className={styles.bannerPlayer}>{copy.player}</span> : null}
      {copy.assist ? (
        <span className={styles.bannerAssist}>{t('match_broadcast.effects.assist_tag', { player: copy.assist })}</span>
      ) : null}
    </div>
  );
}