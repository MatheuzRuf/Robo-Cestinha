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
  Math.sqrt(
    THREE_POINT_RADIUS_FT ** 2 -
      (COURT_HEIGHT_FT / 2 - CORNER_THREE_SIDELINE_GAP_FT) ** 2
  );

export function gameToSvg(x: number, y: number) {
  return { cx: x * SCALE, cy: y * SCALE };
}

export function ft(value: number) {
  return value * SCALE;
}