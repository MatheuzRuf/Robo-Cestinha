import styles from './Court.module.css';
import {
  COURT_WIDTH_FT,
  COURT_HEIGHT_FT,
  CENTER_CIRCLE_RADIUS_FT,
  KEY_WIDTH_FT,
  KEY_LENGTH_FT,
  FREE_THROW_RADIUS_FT,
  HOOP_DISTANCE_FROM_BASELINE_FT,
  HOOP_RADIUS_FT,
  THREE_POINT_RADIUS_FT,
  THREE_POINT_CORNER_X_FT,
  CORNER_THREE_SIDELINE_GAP_FT,
  ft,
} from '../../config/court';

export function Court() {
  const w = ft(COURT_WIDTH_FT);
  const h = ft(COURT_HEIGHT_FT);
  const midY = h / 2;

  const keyHalfWidth = ft(KEY_WIDTH_FT) / 2;
  const keyLength = ft(KEY_LENGTH_FT);
  const freeThrowR = ft(FREE_THROW_RADIUS_FT);
  const centerR = ft(CENTER_CIRCLE_RADIUS_FT);
  const hoopR = ft(HOOP_RADIUS_FT);

  const hoopX = ft(HOOP_DISTANCE_FROM_BASELINE_FT);
  const hoopXRight = w - hoopX;

  const threeR = ft(THREE_POINT_RADIUS_FT);
  const cornerX = ft(THREE_POINT_CORNER_X_FT);
  const cornerY = ft(CORNER_THREE_SIDELINE_GAP_FT);
  const cornerYBottom = h - cornerY;

  return (
    <g>
      <rect x={0} y={0} width={w} height={h} className={styles.court} />

      <line x1={w / 2} y1={0} x2={w / 2} y2={h} className={styles.line} />
      <circle cx={w / 2} cy={midY} r={centerR} className={styles.line} />

      {/* left key + free-throw circle */}
      <rect
        x={0}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.line}
      />
      <circle cx={keyLength} cy={midY} r={freeThrowR} className={styles.line} />

      {/* right key + free-throw circle */}
      <rect
        x={w - keyLength}
        y={midY - keyHalfWidth}
        width={keyLength}
        height={keyHalfWidth * 2}
        className={styles.line}
      />
      <circle cx={w - keyLength} cy={midY} r={freeThrowR} className={styles.line} />

      {/* left three-point line */}
      <path
        d={`M 0 ${cornerY} L ${cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 1 ${cornerX} ${cornerYBottom} L 0 ${cornerYBottom}`}
        className={styles.line}
      />

      {/* right three-point line */}
      <path
        d={`M ${w} ${cornerY} L ${w - cornerX} ${cornerY} A ${threeR} ${threeR} 0 0 0 ${w - cornerX} ${cornerYBottom} L ${w} ${cornerYBottom}`}
        className={styles.line}
      />

      <circle cx={hoopX} cy={midY} r={hoopR} className={styles.hoop} />
      <circle cx={hoopXRight} cy={midY} r={hoopR} className={styles.hoop} />
    </g>
  );
}