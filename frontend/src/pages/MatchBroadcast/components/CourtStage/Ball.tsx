import { motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo } from 'react';
import type { BallFlightPlan, FlightPathPoint } from '../../hooks/ballFlight';
import { SCALE, gameToSvg } from '../../../../config/court';
import { BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const PASS_EASE = [0.22, 0.61, 0.36, 1] as const;
const RIM = BALL_RADIUS;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 16, y: 11 };

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
  const sphereId = useId();
  const shadowId = useId();
  const clipId = useId();
  const reduceMotion = useReducedMotion();
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

  // Flight spin: full 360° on parabolic shots/rebounds, 180° on passes, 0° held.
  const spinning = keyframes.length > 1 && !reduceMotion;
  const spin = !spinning ? 0 : plan.hasArc ? 360 : 180;

  return (
    <>
      <motion.g animate={shadowAnimate} transition={transition} aria-hidden="true">
        <ellipse rx={BALL_RADIUS * 1.05} ry={BALL_RADIUS * 0.55} fill={`url(#${shadowId})`} className={styles.ballShadow} />
      </motion.g>
      <motion.g animate={ballAnimate} transition={transition}>
        <defs>
          <radialGradient id={sphereId} cx="34%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffb347" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </radialGradient>
          <radialGradient id={shadowId}>
            <stop offset="0%" stopColor="rgba(10, 8, 6, 0.72)" />
            <stop offset="100%" stopColor="rgba(10, 8, 6, 0)" />
          </radialGradient>
          <clipPath id={clipId}>
            <circle r={RIM} />
          </clipPath>
        </defs>
        <motion.g
          animate={{ rotate: spin }}
          transition={{ duration: transitionDuration, ease: plan.hasArc ? 'linear' : PASS_EASE }}
        >
          {isHeld ? <circle r={RIM + 1.6} className={styles.heldHalo} /> : null}
          <circle r={RIM} fill={`url(#${sphereId})`} />
          <g clipPath={`url(#${clipId})`}>
            <g className={styles.ballSeam}>
              <path d={`M ${-RIM} 0 H ${RIM}`} />
              <path d={`M 0 ${-RIM} V ${RIM}`} />
              <path d={`M 0 ${-RIM} C ${-RIM * 0.92} ${-RIM * 0.5} ${-RIM * 0.92} ${RIM * 0.5} 0 ${RIM}`} />
              <path d={`M 0 ${-RIM} C ${RIM * 0.92} ${-RIM * 0.5} ${RIM * 0.92} ${RIM * 0.5} 0 ${RIM}`} />
            </g>
          </g>
          <ellipse cx={-RIM * 0.3} cy={-RIM * 0.38} rx={RIM * 0.32} ry={RIM * 0.2} className={styles.specular} />
          <circle r={RIM} className={styles.ballOutline} />
        </motion.g>
      </motion.g>
    </>
  );
}