import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import type { FlightPathPoint } from '../../hooks/useGameFrames';
import { gameToSvg } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 15, y: 10 };

/** SVG-space path point. */
interface SvgPoint {
  x: number;
  y: number;
}

function svgPoint(point: FlightPathPoint): SvgPoint {
  const { cx, cy } = gameToSvg(point.x, point.y);
  return { x: cx, y: cy };
}

/** Normalized times [0, t1, ..., 1] proportional to each segment's length. */
function segmentTimes(points: readonly SvgPoint[]): number[] {
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) {
    return points.map((_, index) => (points.length > 1 ? index / (points.length - 1) : 0));
  }
  const times = [0];
  let acc = 0;
  for (const length of lengths) {
    acc += length / total;
    times.push(acc);
  }
  return times;
}

export function Ball({
  path,
  transitionDuration,
  isHeld = false,
}: {
  /**
   * Ball flight polyline in court feet: the complete path played during this
   * frame, including the shot arc apexes and the rebound catch waypoint. The
   * first point is the position the ball holds when the frame starts.
   */
  path: FlightPathPoint[];
  transitionDuration: number;
  isHeld?: boolean;
}) {
  const points = useMemo(() => path.map(svgPoint), [path]);
  const times = useMemo(() => segmentTimes(points), [points]);
  const motionX = useMemo(() => {
    if (points.length === 1) return isHeld ? points[0].x + HELD_BALL_OFFSET.x : points[0].x;
    return points.map((point, index) =>
      index === points.length - 1 && isHeld ? point.x + HELD_BALL_OFFSET.x : point.x,
    );
  }, [points, isHeld]);
  const motionY = useMemo(() => {
    if (points.length === 1) return isHeld ? points[0].y + HELD_BALL_OFFSET.y : points[0].y;
    return points.map((point, index) =>
      index === points.length - 1 && isHeld ? point.y + HELD_BALL_OFFSET.y : point.y,
    );
  }, [points, isHeld]);
  const transition = useMemo(
    () => ({
      duration: Math.max(transitionDuration, 0.01),
      ease: 'linear' as const,
      times: points.length > 1 ? times : undefined,
    }),
    [transitionDuration, points, times],
  );

  return (
    <motion.g animate={{ x: motionX, y: motionY }} transition={transition}>
      <motion.circle r={BALL_RADIUS} className={`${styles.ball} ${isHeld ? styles.held : ''}`.trim()} style={style} />
    </motion.g>
  );
}
