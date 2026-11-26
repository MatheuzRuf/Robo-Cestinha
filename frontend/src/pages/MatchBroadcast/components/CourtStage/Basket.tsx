import type { CSSProperties } from 'react';
import styles from './Court.module.css';
import {
  BACKBOARD_WIDTH_FT,
  COURT_HEIGHT_FT,
  COURT_WIDTH_FT,
  ft,
  type HoopSide,
} from '../../../../config/court';

const BASKET_BACKBOARD_FT = 4; // backboard face 4 ft inside the baseline
const RIM_RADIUS_SVG = 8.5;
const BACKBOARD_THICKNESS_SVG = 5;
const SHOOTERS_SQUARE_HEIGHT_SVG = 18;

interface BasketProps {
  side: HoopSide;
  madeBasketSide?: HoopSide;
  pulseDelayMs?: number;
  hoopX: number;
}

export function Basket({ side, madeBasketSide, pulseDelayMs = 0, hoopX }: BasketProps) {
  const w = ft(COURT_WIDTH_FT);
  const midY = ft(COURT_HEIGHT_FT) / 2;
  // Hoop is at LEFT_HOOP_FT / RIGHT_HOOP_FT; a backboard sits behind it.
  const backboardX = side === 'left' ? ft(BASKET_BACKBOARD_FT) : w - ft(BASKET_BACKBOARD_FT);
  const backboardHalf = ft(BACKBOARD_WIDTH_FT) / 2;
  const isMade = madeBasketSide === side;

  // Stanchion base pad sits just outside the baseline.
  const baseX = side === 'left' ? -22 : w + 22;

  return (
    <g>
      <path
        d={`M ${baseX - 4} ${midY - 20} H ${baseX + 4} V ${midY + 20} H ${baseX - 4} Z`}
        className={styles.stanchion}
      />
      <path d={`M ${baseX} ${midY} L ${backboardX} ${midY}`} className={styles.stanchionBoom} />

      {/* 6-ft glass backboard with shooter's square. */}
      <rect
        x={backboardX - BACKBOARD_THICKNESS_SVG / 2}
        y={midY - backboardHalf}
        width={BACKBOARD_THICKNESS_SVG}
        height={backboardHalf * 2}
        rx={1.5}
        className={styles.backboardGlass}
      />
      <rect
        x={backboardX - BACKBOARD_THICKNESS_SVG / 2}
        y={midY - backboardHalf}
        width={BACKBOARD_THICKNESS_SVG}
        height={backboardHalf * 2}
        rx={1.5}
        className={styles.backboardFrame}
      />
      <rect
        x={backboardX - BACKBOARD_THICKNESS_SVG / 2}
        y={midY - SHOOTERS_SQUARE_HEIGHT_SVG / 2}
        width={BACKBOARD_THICKNESS_SVG}
        height={SHOOTERS_SQUARE_HEIGHT_SVG}
        className={styles.shootersSquare}
      />

      {/* Rim mounting neck. */}
      <line x1={backboardX} y1={midY} x2={hoopX} y2={midY} className={styles.rimNeck} />

      {/* Woven mesh net (behind the rim, recessed inside it). */}
      <g
        transform={`translate(${hoopX} ${midY})`}
        className={`${styles.net} ${isMade ? styles.netSwish : ''}`.trim()}
        style={{ '--net-swish-delay': `${pulseDelayMs}ms` } as CSSProperties}
      >
        <path d="M -6.5 -5 L 0 14 M 6.5 -5 L 0 14 M 0 -8.5 L 0 16" />
        <path d="M -8.2 0 L 0 16 M 8.2 0 L 0 16" />
        <path d="M -5 6 H 5 M -3 10 H 3 M -1.5 13 H 1.5" />
      </g>

      {/* Open metallic orange rim with shadow + highlight. */}
      <circle cx={hoopX} cy={midY} r={RIM_RADIUS_SVG + 1.4} className={styles.rimShadow} />
      <circle cx={hoopX} cy={midY} r={RIM_RADIUS_SVG} className={styles.rim} />
      <circle cx={hoopX} cy={midY} r={RIM_RADIUS_SVG - 1.1} className={styles.rimInner} />

      {/* Made-basket pulse. */}
      {isMade ? (
        <circle
          cx={hoopX}
          cy={midY}
          r={RIM_RADIUS_SVG}
          className={styles.basketPulse}
          style={{ '--basket-pulse-delay': `${pulseDelayMs}ms` } as CSSProperties}
        />
      ) : null}
    </g>
  );
}