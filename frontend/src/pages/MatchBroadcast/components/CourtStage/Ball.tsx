import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { BallState } from '../../../../types/game';
import { gameToSvg, SCALE } from '../../../../config/court';
import { BALL_COLOR, BALL_RADIUS } from '../../../../config/teams';
import styles from './Ball.module.css';

const style = { '--ball-color': BALL_COLOR } as CSSProperties;

/** Offset applied when the ball is held so it does not cover the handler's portrait. */
export const HELD_BALL_OFFSET = { x: 15, y: 10 };

/**
 * Parabolic arc peak (in feet) while the ball flies to the rim on a shot
 * frame. Scaled by the flight length so short shots stay flat and long ones
 * arc higher, capped to a plausible 6..12 ft (D8a).
 */
export function shotArcPeakFt(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(6, Math.min(12, distance * 0.22));
}

export function Ball({
  ball,
  transitionDuration,
  isHeld = false,
  arcPeakFt = 0,
}: {
  ball: BallState;
  transitionDuration: number;
  isHeld?: boolean;
  /** Feet of synthetic ball lift on shot frames; 0 disables the arc. */
  arcPeakFt?: number;
}) {
  const { cx, cy } = gameToSvg(ball.x, ball.y);
  const targetX = isHeld ? cx + HELD_BALL_OFFSET.x : cx;
  const targetY = isHeld ? cy + HELD_BALL_OFFSET.y : cy;
  const height = useMotionValue(0);
  const hasArc = arcPeakFt > 0;

  useEffect(() => {
    if (hasArc) {
      const controls = animate(height, [0, arcPeakFt, 0], {
        duration: Math.max(transitionDuration, 0.01),
        times: [0, 0.5, 1],
        ease: 'easeInOut',
      });
      return () => controls.stop();
    }
    height.set(0);
    return undefined;
  }, [hasArc, height, arcPeakFt, transitionDuration]);

  const baseLiftFt = hasArc ? 0 : (ball.height ?? 0);
  const arcCy = useTransform(height, (lift) => -(lift + baseLiftFt) * SCALE);

  return (
    <motion.g animate={{ x: targetX, y: targetY }} transition={{ duration: transitionDuration, ease: 'linear' }}>
      <motion.circle
        r={BALL_RADIUS}
        className={`${styles.ball} ${isHeld ? styles.held : ''}`.trim()}
        style={{ ...style, cx: 0, cy: arcCy }}
      />
    </motion.g>
  );
}
