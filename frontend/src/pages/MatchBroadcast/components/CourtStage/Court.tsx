import type { CSSProperties } from 'react';
import styles from './Court.module.css';
import {
  COURT_WIDTH_FT,
  COURT_HEIGHT_FT,
  CENTER_CIRCLE_RADIUS_FT,
  KEY_WIDTH_FT,
  KEY_LENGTH_FT,
  FREE_THROW_RADIUS_FT,
  HOOP_RADIUS_FT,
  LEFT_HOOP_FT,
  RIGHT_HOOP_FT,
  THREE_POINT_RADIUS_FT,
  THREE_POINT_CORNER_X_FT,
  CORNER_THREE_SIDELINE_GAP_FT,
  ft,
  gameToSvg,
  type HoopSide,
} from '../../../../config/court';

export function Court({
  madeBasketSide,
  basketPulseDelayMs = 0,
}: {
  madeBasketSide?: HoopSide;
  basketPulseDelayMs?: number;
}) {
  const w = ft(COURT_WIDTH_FT);
  const h = ft(COURT_HEIGHT_FT);
  const midY = h / 2;
  const keyHalfWidth = ft(KEY_WIDTH_FT) / 2;
  const keyLength = ft(KEY_LENGTH_FT);
  const freeThrowR = ft(FREE_THROW_RADIUS_FT);
  const centerR = ft(CENTER_CIRCLE_RADIUS_FT);
  const hoopR = ft(HOOP_RADIUS_FT);
  const leftHoop = gameToSvg(LEFT_HOOP_FT.x, LEFT_HOOP_FT.y);
  const rightHoop = gameToSvg(RIGHT_HOOP_FT.x, RIGHT_HOOP_FT.y);
  const hoopX = leftHoop.cx;
  const hoopXRight = rightHoop.cx;
  const threeR = ft(THREE_POINT_RADIUS_FT);
  const cornerX = ft(THREE_POINT_CORNER_X_FT);
  const cornerY = ft(CORNER_THREE_SIDELINE_GAP_FT);
  const cornerYBottom = h - cornerY;

  return (
    <g>
      <defs>
        <pattern id="court-wood" width="120" height="24" patternUnits="userSpaceOnUse">
          <rect width="120" height="24" style={{ fill: 'var(--color-court-wood)' }} />
          <path
            d="M0 1H120M0 23H120"
            style={{ stroke: 'var(--color-court-wood-grain)' }}
            strokeWidth="1"
            opacity=".7"
          />
          <path d="M40 0V24M80 0V24" style={{ stroke: 'var(--color-court-wood-seam)' }} strokeWidth="1" opacity=".55" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={w} height={h} className={styles.court} />
      <rect x={0} y={0} width={w} height={h} fill="url(#court-wood)" opacity=".9" />
      <rect x={0} y={0} width={w} height={h} className={styles.boundary} />
      <rect x={0} y={midY - keyHalfWidth} width={keyLength} height={keyHalfWidth * 2} className={styles.keyPaint} />
      <rect
        x={w - keyLength}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.keyPaint}
      />
      <circle cx={w / 2} cy={midY} r={centerR} className={styles.centerCircleFill} />
      <line x1={w / 2} y1={0} x2={w / 2} y2={h} className={styles.line} />
      <circle cx={w / 2} cy={midY} r={centerR} className={styles.line} />
      <rect x={0} y={midY - keyHalfWidth} width={keyLength} height={keyHalfWidth * 2} className={styles.line} />
      <circle cx={keyLength} cy={midY} r={freeThrowR} className={styles.line} />
      <rect
        x={w - keyLength}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.line}
      />
      <circle cx={w - keyLength} cy={midY} r={freeThrowR} className={styles.line} />
      <path d={`M ${keyLength - 1} ${midY - keyHalfWidth} V ${midY + keyHalfWidth}`} className={styles.line} />
      <path d={`M ${w - keyLength + 1} ${midY - keyHalfWidth} V ${midY + keyHalfWidth}`} className={styles.line} />
      <path
        d={`M 0 ${cornerY} L ${cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 1 ${cornerX} ${cornerYBottom} L 0 ${cornerYBottom}`}
        className={styles.line}
      />
      <path
        d={`M ${w} ${cornerY} L ${w - cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 0 ${w - cornerX} ${cornerYBottom} L ${w} ${cornerYBottom}`}
        className={styles.line}
      />
      <circle cx={hoopX} cy={midY} r={hoopR} className={styles.hoop} />
      <circle cx={hoopXRight} cy={midY} r={hoopR} className={styles.hoop} />
      {madeBasketSide ? (
        <circle
          cx={madeBasketSide === 'left' ? hoopX : hoopXRight}
          cy={midY}
          r={hoopR + 1.2}
          className={styles.basketPulse}
          style={{ '--basket-pulse-delay': `${basketPulseDelayMs}ms` } as CSSProperties}
        />
      ) : null}
      <line x1={hoopX - 8} y1={midY - 8} x2={hoopX - 8} y2={midY + 8} className={styles.backboard} />
      <line x1={hoopXRight + 8} y1={midY - 8} x2={hoopXRight + 8} y2={midY + 8} className={styles.backboard} />
    </g>
  );
}
