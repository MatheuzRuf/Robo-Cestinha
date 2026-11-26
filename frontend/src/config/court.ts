export const COURT_WIDTH_FT = 94;
export const COURT_HEIGHT_FT = 50;
export const SCALE = 10; // 1 foot = 10 SVG units

export const CENTER_CIRCLE_RADIUS_FT = 6;
export const KEY_WIDTH_FT = 16;
export const KEY_LENGTH_FT = 19;
export const FREE_THROW_RADIUS_FT = 6;
export const HOOP_DISTANCE_FROM_BASELINE_FT = 5.25;
export const HOOP_RADIUS_FT = 0.75;
export const THREE_POINT_RADIUS_FT = 23.75;
export const CORNER_THREE_SIDELINE_GAP_FT = 3;

export const THREE_POINT_CORNER_X_FT =
  HOOP_DISTANCE_FROM_BASELINE_FT +
  Math.sqrt(THREE_POINT_RADIUS_FT ** 2 - (COURT_HEIGHT_FT / 2 - CORNER_THREE_SIDELINE_GAP_FT) ** 2);

export type HoopSide = 'left' | 'right';

export const LEFT_HOOP_FT = {
  x: HOOP_DISTANCE_FROM_BASELINE_FT,
  y: COURT_HEIGHT_FT / 2,
} as const;

export const RIGHT_HOOP_FT = {
  x: COURT_WIDTH_FT - HOOP_DISTANCE_FROM_BASELINE_FT,
  y: COURT_HEIGHT_FT / 2,
} as const;

export function hoopPositionFt(side: HoopSide): { x: number; y: number } {
  return side === 'left' ? { ...LEFT_HOOP_FT } : { ...RIGHT_HOOP_FT };
}

export function hoopSideFromX(x: number): HoopSide {
  return x < COURT_WIDTH_FT / 2 ? 'left' : 'right';
}

export function oppositeHoopSide(side: HoopSide): HoopSide {
  return side === 'left' ? 'right' : 'left';
}

export function gameToSvg(x: number, y: number) {
  return { cx: x * SCALE, cy: y * SCALE };
}

export function ft(value: number) {
  return value * SCALE;
}
