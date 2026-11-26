import type { BallTrajectory, Frame } from '../../../../types/game';
import { computeBallFlightPlan, normalizeShotTarget, shotArcPeakFt } from '../../hooks/ballFlight';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player, STAMINA_LEGEND_TIERS } from './Player';
import { CourtEffectBanner, CourtEffectsSvg, type FrameEffect } from './CourtEffects';
import { SCALE, gameToSvg, type HoopSide } from '../../../../config/court';
import trajectoryStyles from './Ball.module.css';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/i18n';

interface CourtStageProps {
  frame: Frame | null;
  previousFrame?: Frame | null;
  transitionDurationMs: number;
  madeBasketSide?: HoopSide;
  effects?: FrameEffect[];
}

const TRAJECTORY_HOLD_MIN_MS = 700;
const BANNER_HOLD_FACTOR = 1.1;

// Lower number = higher banner priority. A missed shot + rebound frame now
// always surfaces the rebound banner instead of being hidden behind "MISSED".
const EFFECT_BANNER_PRIORITY: Record<FrameEffect['kind'], number> = {
  score: 0,
  rebound: 1,
  intercept: 2,
  steal: 3,
  foul: 4,
  miss: 5,
};

export function CourtStage({ frame, previousFrame, transitionDurationMs, madeBasketSide, effects }: CourtStageProps) {
  const { t } = useTranslation();
  const transitionDuration = transitionDurationMs / 1000;
  const [visibleTrajectory, setVisibleTrajectory] = useState<BallTrajectory | null>(null);
  const [visibleBanner, setVisibleBanner] = useState<FrameEffect | null>(null);
  const trajectoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startBannerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!frame?.trajectory) return;

    startTransition(() => setVisibleTrajectory(frame.trajectory!));
    if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);

    trajectoryTimeoutRef.current = setTimeout(() => {
      startTransition(() => setVisibleTrajectory(null));
      trajectoryTimeoutRef.current = undefined;
    }, transitionDurationMs);
  }, [frame, transitionDurationMs]);

  const primaryEffect = effects?.length
    ? effects.reduce<FrameEffect | null>((best, effect) => {
        if (!best) return effect;
        return EFFECT_BANNER_PRIORITY[effect.kind] < EFFECT_BANNER_PRIORITY[best.kind] ? effect : best;
      }, null)
    : null;
  const primaryEffectKey = primaryEffect ? `${primaryEffect.kind}-${primaryEffect.sequence}` : null;
  const bannerHoldMs = Math.max(TRAJECTORY_HOLD_MIN_MS, Math.round(transitionDurationMs * BANNER_HOLD_FACTOR));

  // Full per-leg ball flight plan for this frame, including shot arcs, catch
  // dwell, and rebound timing.
  const flightPlan = useMemo(
    () => (frame ? computeBallFlightPlan(previousFrame, frame) : null),
    [frame, previousFrame],
  );
  const catchInfo = flightPlan?.reboundCatch ?? null;
  const reboundCatchDelayMs = catchInfo ? Math.round(catchInfo.timeFraction * transitionDurationMs * 0.9) : 0;

  const hasScoreEffect = effects?.some((effect) => effect.kind === 'score') ?? false;
  // Normal made baskets render on the kickoff frame where the ball is already at
  // the rim at t=0 (delay 0). Only a final-frame overtime game-winner still sits
  // on a shot frame and needs to wait for its flight.
  const rimImpactDelayMs =
    hasScoreEffect && frame?.trajectory?.type === 'shot' ? Math.round(transitionDurationMs * 0.85) : 0;
  const bannerStartDelayMs = primaryEffect
    ? primaryEffect.kind === 'rebound'
      ? reboundCatchDelayMs
      : primaryEffect.kind === 'score'
        ? rimImpactDelayMs
        : 0
    : 0;

  useEffect(() => {
    if (!primaryEffect) {
      setVisibleBanner(null);
      return;
    }
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    if (startBannerRef.current) clearTimeout(startBannerRef.current);

    if (bannerStartDelayMs > 0) {
      startBannerRef.current = setTimeout(() => setVisibleBanner(primaryEffect), bannerStartDelayMs);
      bannerTimeoutRef.current = setTimeout(() => {
        setVisibleBanner(null);
        bannerTimeoutRef.current = undefined;
      }, bannerStartDelayMs + bannerHoldMs);
    } else {
      setVisibleBanner(primaryEffect);
      bannerTimeoutRef.current = setTimeout(() => {
        setVisibleBanner(null);
        bannerTimeoutRef.current = undefined;
      }, bannerHoldMs);
    }
    // The banner only depends on which effect became active, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryEffectKey, bannerHoldMs, bannerStartDelayMs]);

  useEffect(() => {
    return () => {
      if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      if (startBannerRef.current) clearTimeout(startBannerRef.current);
    };
  }, []);

  const hasStamina = frame?.players.some((player) => player.stamina !== undefined && player.stamina !== null) ?? false;

  // The rebounder holds position until the ball arrives and is secured before starting the next move.
  const rebounderId = useMemo(() => {
    if (!catchInfo || !previousFrame) return null;
    if (previousFrame.ball.holderId) return previousFrame.ball.holderId;

    let bestId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const player of previousFrame.players) {
      const distance = Math.hypot(player.x - catchInfo.point.x, player.y - catchInfo.point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = player.id;
      }
    }
    return bestDistance < 3 ? bestId : null;
  }, [catchInfo, previousFrame]);

  const trajectory = visibleTrajectory;
  const trajectoryEndFt = trajectory
    ? trajectory.type === 'shot'
      ? normalizeShotTarget(trajectory.to)
      : trajectory.to
    : null;
  const start = trajectory ? gameToSvg(trajectory.from.x, trajectory.from.y) : null;
  const end = trajectoryEndFt ? gameToSvg(trajectoryEndFt.x, trajectoryEndFt.y) : null;
  const shotPathD = useMemo(() => {
    if (!trajectory || trajectory.type !== 'shot' || !start || !end || !trajectoryEndFt) return null;
    const peakPx = shotArcPeakFt(trajectory.from, trajectoryEndFt) * SCALE;
    const midX = (start.cx + end.cx) / 2;
    const controlY = (start.cy + end.cy) / 2 - 2 * peakPx;
    return `M ${start.cx} ${start.cy} Q ${midX} ${controlY} ${end.cx} ${end.cy}`;
  }, [trajectory, start, end, trajectoryEndFt]);

  const trajectoryClass = trajectory
    ? trajectory.fromTeam !== trajectory.toTeam
      ? trajectoryStyles.opponentTrajectory
      : trajectoryStyles.sameTeamTrajectory
    : undefined;

  const isKickoffReset = frame?.phase === 'kickoff';

  return (
    <div className={styles.stage}>
      <svg
        viewBox="-52 -46 1044 612"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('match_broadcast.simulation.court_label')}
      >
        <Court madeBasketSide={madeBasketSide} basketPulseDelayMs={rimImpactDelayMs} />
        {shotPathD ? (
          <path d={shotPathD} className={`${trajectoryStyles.trajectory} ${trajectoryClass ?? ''}`.trim()} />
        ) : start && end ? (
          <line
            x1={start.cx}
            y1={start.cy}
            x2={end.cx}
            y2={end.cy}
            className={`${trajectoryStyles.trajectory} ${trajectoryClass ?? ''}`.trim()}
          />
        ) : null}
        {frame?.players.map((player) => (
          <Player
            key={player.id}
            player={player}
            transitionDuration={transitionDuration}
            motionDelay={
              player.id === rebounderId && catchInfo && catchInfo.moveDelayFraction < 0.99
                ? catchInfo.moveDelayFraction * transitionDuration
                : 0
            }
            isKickoffReset={isKickoffReset}
          />
        ))}
        {frame && flightPlan ? (
          <Ball plan={flightPlan} transitionDuration={transitionDuration} isHeld={frame.ball.isHeld ?? false} />
        ) : null}
        {effects && effects.length ? (
          <CourtEffectsSvg
            effects={effects}
            rimImpactDelayMs={rimImpactDelayMs}
            reboundCatchDelayMs={reboundCatchDelayMs}
          />
        ) : null}
      </svg>
      {hasStamina ? (
        <div className={styles.staminaLegend} aria-label={t('match_broadcast.stamina.label')}>
          <span className={styles.staminaLegendTitle}>{t('match_broadcast.stamina.label')}</span>
          {STAMINA_LEGEND_TIERS.map((tier) => (
            <span key={tier.tier} className={styles.staminaLegendItem}>
              <span className={styles.staminaLegendDot} style={{ background: tier.color }} />
              {t(`match_broadcast.stamina.${tier.tier}`)}
            </span>
          ))}
        </div>
      ) : null}
      {visibleBanner ? <CourtEffectBanner effect={visibleBanner} durationMs={transitionDurationMs} /> : null}
    </div>
  );
}
