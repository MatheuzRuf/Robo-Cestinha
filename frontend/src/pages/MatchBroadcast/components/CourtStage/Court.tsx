import { Basket } from './Basket';
import styles from './Court.module.css';
import {
  CENTER_CIRCLE_RADIUS_FT,
  CENTER_INNER_CIRCLE_RADIUS_FT,
  COACHING_HASH_FROM_BASELINE_FT,
  CORNER_THREE_SIDELINE_GAP_FT,
  COURT_HEIGHT_FT,
  COURT_WIDTH_FT,
  FREE_THROW_RADIUS_FT,
  KEY_LENGTH_FT,
  KEY_WIDTH_FT,
  LANE_HASH_POSITIONS_FT,
  RESTRICTED_AREA_RADIUS_FT,
  THREE_POINT_CORNER_X_FT,
  THREE_POINT_RADIUS_FT,
  ft,
  gameToSvg,
  type HoopSide,
} from '../../../../config/court';

/** Short horizontal stem between a hoop and its restricted-area arc. */
const RESTRICTED_STEM_FT = 1.0;

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
  const centerInnerR = ft(CENTER_INNER_CIRCLE_RADIUS_FT);
  const threeR = ft(THREE_POINT_RADIUS_FT);
  const cornerX = ft(THREE_POINT_CORNER_X_FT);
  const cornerY = ft(CORNER_THREE_SIDELINE_GAP_FT);
  const cornerYBottom = h - cornerY;
  const restrictedR = ft(RESTRICTED_AREA_RADIUS_FT);
  const restrictedStem = ft(RESTRICTED_STEM_FT);
  const hoopLeft = gameToSvg(5.25, 25);
  const hoopRight = gameToSvg(88.75, 25);
  const backboardLeftX = ft(4);
  const backboardRightX = w - ft(4);
  const coachingHashX = ft(COACHING_HASH_FROM_BASELINE_FT);
  const coachingHashXRight = w - ft(COACHING_HASH_FROM_BASELINE_FT);
  const laneHashXs = LANE_HASH_POSITIONS_FT.map((feet) => ft(feet));
  const laneHashXsRight = LANE_HASH_POSITIONS_FT.map((feet) => w - ft(feet));

  return (
    <g>
      <defs>
        <pattern id="court-wood" width="240" height="48" patternUnits="userSpaceOnUse">
          <rect width="240" height="48" style={{ fill: 'var(--color-court-wood)' }} />
          {/* Four staggered 12px plank rows with butt joints + grain. */}
          <rect y={0} width="240" height="12" style={{ fill: 'var(--color-court-wood-light)' }} opacity=".35" />
          <rect y={12} width="240" height="12" style={{ fill: 'var(--color-court-wood)' }} />
          <rect y={24} width="240" height="12" style={{ fill: 'var(--color-court-wood-dark)' }} opacity=".5" />
          <rect y={36} width="240" height="12" style={{ fill: 'var(--color-court-wood)' }} />
          <path
            d="M 0 1 H 240 M 0 13 H 240 M 0 25 H 240 M 0 37 H 240"
            style={{ stroke: 'var(--color-court-wood-grain)' }}
            strokeWidth="1"
            opacity=".6"
          />
          {/* Staggered vertical butt joints. */}
          <path d="M 88 0 V 12 M 40 12 V 24 M 184 24 V 36 M 112 36 V 48" className={styles.plankJoint} />
        </pattern>
        <radialGradient id="court-sheen">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Arena apron behind the hardwood floor. */}
      <rect x={-32} y={-26} width={w + 64} height={h + 52} rx={10} className={styles.courtApron} />

      {/* Hardwood floor + staggered plank overlay + spotlight sheen. */}
      <rect x={0} y={0} width={w} height={h} className={styles.court} />
      <rect x={0} y={0} width={w} height={h} fill="url(#court-wood)" opacity=".92" />
      <rect x={0} y={0} width={w} height={h} fill="url(#court-sheen)" />
      <rect x={0} y={0} width={w} height={h} className={styles.boundary} />

      {/* Half-court line + center circles + medallion. */}
      <line x1={w / 2} y1={0} x2={w / 2} y2={h} className={styles.line} />
      <circle cx={w / 2} cy={midY} r={centerR} className={styles.line} />
      <circle cx={w / 2} cy={midY} r={centerInnerR} className={styles.line} />
      <g transform={`translate(${w / 2} ${midY})`} className={styles.emblem} strokeWidth="2.2">
        {/* minimal basketball emblem */}
        <circle r={centerInnerR} />
        <line x1={0} y1={-centerInnerR} x2={0} y2={centerInnerR} />
        <circle r={centerInnerR * 0.62} fill="none" opacity=".5" />
      </g>

      {/* Painted keys. */}
      <rect x={0} y={midY - keyHalfWidth} width={keyLength} height={keyHalfWidth * 2} className={styles.keyAccent} />
      <rect
        x={w - keyLength}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.keyAccent}
      />
      <rect x={0} y={midY - keyHalfWidth} width={keyLength} height={keyHalfWidth * 2} className={styles.line} />
      <rect
        x={w - keyLength}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.line}
      />

      {/* Free-throw circles: solid outer semicircle + dashed inner arc. */}
      <path d={`M ${keyLength} ${midY - freeThrowR} A ${freeThrowR} ${freeThrowR} 0 0 1 ${keyLength} ${midY + freeThrowR}`} className={styles.line} />
      <path d={`M ${keyLength} ${midY - freeThrowR + 9} A ${freeThrowR - 9} ${freeThrowR - 9} 0 0 1 ${keyLength} ${midY + freeThrowR - 9}`} className={`${styles.line} ${styles.dashedLine}`} />
      <path d={`M ${w - keyLength} ${midY - freeThrowR} A ${freeThrowR} ${freeThrowR} 0 0 0 ${w - keyLength} ${midY + freeThrowR}`} className={styles.line} />
      <path d={`M ${w - keyLength} ${midY - freeThrowR + 9} A ${freeThrowR - 9} ${freeThrowR - 9} 0 0 0 ${w - keyLength} ${midY + freeThrowR - 9}`} className={`${styles.line} ${styles.dashedLine}`} />

      {/* Restricted-area arcs with horizontal stems. */}
      <path
        d={`M ${backboardLeftX} ${midY - restrictedR} H ${backboardLeftX + restrictedStem} A ${restrictedR} ${restrictedR} 0 0 1 ${backboardLeftX + restrictedStem} ${midY + restrictedR} H ${backboardLeftX}`}
        className={styles.line}
      />
      <path
        d={`M ${backboardRightX} ${midY - restrictedR} H ${backboardRightX - restrictedStem} A ${restrictedR} ${restrictedR} 0 0 0 ${backboardRightX - restrictedStem} ${midY + restrictedR} H ${backboardRightX}`}
        className={styles.line}
      />

      {/* Three-point arcs (corner -> arc -> corner). */}
      <path
        d={`M 0 ${cornerY} L ${cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 1 ${cornerX} ${cornerYBottom} L 0 ${cornerYBottom}`}
        className={styles.line}
      />
      <path
        d={`M ${w} ${cornerY} L ${w - cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 0 ${w - cornerX} ${cornerYBottom} L ${w} ${cornerYBottom}`}
        className={styles.line}
      />

      {/* Free-throw lane rebound blocks / hash marks. */}
      {laneHashXs.map((x, i) => (
        <g key={`lh${i}`}>
          <path d={`M ${x} ${midY - keyHalfWidth} V ${midY - keyHalfWidth - 8} M ${x} ${midY + keyHalfWidth} V ${midY + keyHalfWidth + 8}`} className={`${styles.line} ${i === 0 ? styles.neutralZoneBlock : ''}`} strokeWidth={i === 0 ? 4 : 2.2} />
        </g>
      ))}
      {laneHashXsRight.map((x, i) => (
        <g key={`lhr${i}`}>
          <path d={`M ${x} ${midY - keyHalfWidth} V ${midY - keyHalfWidth - 8} M ${x} ${midY + keyHalfWidth} V ${midY + keyHalfWidth + 8}`} className={`${styles.line} ${i === 0 ? styles.neutralZoneBlock : ''}`} strokeWidth={i === 0 ? 4 : 2.2} />
        </g>
      ))}

      {/* Sideline coaching/inbound hashes. */}
      <path d={`M ${coachingHashX} 0 V 30 M ${coachingHashX} ${h} V ${h - 30}`} className={styles.line} />
      <path d={`M ${coachingHashXRight} 0 V 30 M ${coachingHashXRight} ${h} V ${h - 30}`} className={styles.line} />
      {/* Baseline lower-defensive-box ticks. */}
      <path d={`M ${keyLength} 0 H ${keyLength + 30} M ${keyLength} ${h} H ${keyLength + 30}`} className={styles.line} />
      <path d={`M ${w - keyLength} 0 H ${w - keyLength - 30} M ${w - keyLength} ${h} H ${w - keyLength - 30}`} className={styles.line} />

      {/* Full basket assemblies. */}
      <Basket
        side="left"
        madeBasketSide={madeBasketSide}
        pulseDelayMs={basketPulseDelayMs}
        hoopX={hoopLeft.cx}
      />
      <Basket
        side="right"
        madeBasketSide={madeBasketSide}
        pulseDelayMs={basketPulseDelayMs}
        hoopX={hoopRight.cx}
      />
    </g>
  );
}