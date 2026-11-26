import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import type { BallFlightPlan, FlightPathPoint } from '../../hooks/ballFlight';
import { SCALE, gameToSvg } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;
const PASS_EASE = [0.22, 0.61, 0.36, 1] as const;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 15, y: 10 };

interface SvgKeyframe {
  x: number;
  floorY: number;
  ballY: number;
  scale: number;
  shadowScale: number;
  shadowOpacity: number;
}

function toSvgKeyframe(point: FlightPathPoint): SvgKeyframe {
  const { cx, cy } = gameToSvg(point.x, point.y);
  const x = point.held ? cx + HELD_BALL_OFFSET.x : cx;
  const floorY = point.held ? cy + HELD_BALL_OFFSET.y : cy;
  const z = Math.max(0, point.z);
  const ballY = floorY - z * SCALE;
  const scale = 1 + z * 0.022;
  const shadowScale = Math.max(0.55, 1 - z * 0.03);
  const shadowOpacity = z > 0.05 ? Math.max(0.16, 0.38 - z * 0.015) : 0;
  return { x, floorY, ballY, scale, shadowScale, shadowOpacity };
}

export function Ball({
  plan,
  transitionDuration,
  isHeld = false,
}: {
  /**
   * Complete ball flight plan played during this frame, including parabolic
   * shot/rebound elevation (`z`), catch dwell, and normalized keyframe times.
   */
  plan: BallFlightPlan;
  transitionDuration: number;
  isHeld?: boolean;
}) {
  const keyframes = useMemo(() => plan.points.map(toSvgKeyframe), [plan.points]);

  const ballAnimate = useMemo(() => {
    if (keyframes.length === 1) {
      const [only] = keyframes;
      return { x: only.x, y: only.ballY, scale: only.scale };
    }
    return {
      x: keyframes.map((frame) => frame.x),
      y: keyframes.map((frame) => frame.ballY),
      scale: keyframes.map((frame) => frame.scale),
    };
  }, [keyframes]);

  const shadowAnimate = useMemo(() => {
    const shadowOffsetY = BALL_RADIUS * 0.55;
    if (keyframes.length === 1) {
      const [only] = keyframes;
      return {
        x: only.x,
        y: only.floorY + shadowOffsetY,
        scale: only.shadowScale,
        opacity: only.shadowOpacity,
      };
    }
    return {
      x: keyframes.map((frame) => frame.x),
      y: keyframes.map((frame) => frame.floorY + shadowOffsetY),
      scale: keyframes.map((frame) => frame.shadowScale),
      opacity: keyframes.map((frame) => frame.shadowOpacity),
    };
  }, [keyframes]);

  const transition = useMemo(
    () => ({
      duration: Math.max(transitionDuration, 0.01),
      ease: plan.hasArc ? ('linear' as const) : PASS_EASE,
      times: keyframes.length > 1 ? plan.times : undefined,
    }),
    [transitionDuration, plan.hasArc, plan.times, keyframes.length],
  );

  return (
    <>
      <motion.g animate={shadowAnimate} transition={transition} aria-hidden="true">
        <ellipse rx={BALL_RADIUS * 1.05} ry={BALL_RADIUS * 0.55} className={styles.ballShadow} />
      </motion.g>
      <motion.g animate={ballAnimate} transition={transition}>
        <circle r={BALL_RADIUS} className={`${styles.ball} ${isHeld ? styles.held : ''}`.trim()} style={style} />
      </motion.g>
    </>
  );
}
