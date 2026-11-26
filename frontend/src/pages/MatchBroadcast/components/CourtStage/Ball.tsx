import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useEffect, useMemo } from 'react';
import type { FlightPathPoint } from '../../hooks/useGameFrames';
import { gameToSvg, SCALE } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 15, y: 10 };

/** SVG-space flight path point. */
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

/**
 * Parabolic arc peak (in feet) while the ball flies to the rim on a shot
 * frame. Scaled by the flight length so short shots stay flat and long ones
 * arc higher, capped to a plausible 6..12 ft (D8a).
 */
export function shotArcPeakFt(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(6, Math.min(12, distance * 0.22));
}

/**
 * Lift (in feet) as the ball comes off the rim toward the rebounder, matching
 * the decorative ReboundPulse arc scale.
 */
export function reboundLiftFt(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(3, Math.min(6, distance * 0.2));
}

export function Ball({
  path,
  transitionDuration,
  isHeld = false,
  arcPeakFt = 0,
  reboundLift = 0,
}: {
  /** Ball flight polyline in court feet; the last point is the target. */
  path: FlightPathPoint[];
  transitionDuration: number;
  isHeld?: boolean;
  /** Parabolic arc peak applied to the final flight segment (shot frames). */
  arcPeakFt?: number;
  /** Lift applied to the first segment as the ball comes off the rim. */
  reboundLift?: number;
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
  const pathKey = useMemo(
    () => points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join('|'),
    [points],
  );
  const height = useMotionValue(0);

  useEffect(() => {
    if (points.length <= 1) {
      if (arcPeakFt > 0) {
        const controls = animate(height, [0, arcPeakFt, 0], {
          duration: Math.max(transitionDuration, 0.01),
          times: [0, 0.5, 1],
          ease: 'easeInOut',
        });
        return () => controls.stop();
      }
      height.set(0);
      return undefined;
    }

    // Rebound leg: rim -> rebounder (small pop off the rim) -> next target,
    // with an optional shot arc on the final segment when the rebounder shoots.
    const endOfRebound = times[1] ?? 0.5;
    const heights = [0, reboundLift, 0];
    const heightTimes = [0, endOfRebound / 2, endOfRebound];
    if (arcPeakFt > 0) {
      heights.push(arcPeakFt, 0);
      heightTimes.push(endOfRebound + (1 - endOfRebound) / 2, 1);
    } else {
      heights.push(0);
      heightTimes.push(1);
    }
    const controls = animate(height, heights, {
      duration: Math.max(transitionDuration, 0.01),
      times: heightTimes,
      ease: 'easeInOut',
    });
    return () => controls.stop();
    // points/times are recreated per frame change and encoded by pathKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, transitionDuration, arcPeakFt, reboundLift, height]);

  const arcCy = useTransform(height, (lift) => -lift * SCALE);
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
      <motion.circle
        r={BALL_RADIUS}
        className={`${styles.ball} ${isHeld ? styles.held : ''}`.trim()}
        style={{ ...style, cx: 0, cy: arcCy }}
      />
    </motion.g>
  );
}
