import type { BallTrajectory, Frame } from '../../../../types/game';
import { ballFlightPath } from '../../hooks/useGameFrames';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player, STAMINA_LEGEND_TIERS } from './Player';
import { CourtEffectBanner, CourtEffectsSvg, type FrameEffect } from './CourtEffects';
import { gameToSvg } from '../../../../config/court';
import trajectoryStyles from './Ball.module.css';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/i18n';

interface CourtStageProps {
  frame: Frame | null;
  previousFrame?: Frame | null;
  transitionDurationMs: number;
  madeBasketSide?: 'left' | 'right';
  effects?: FrameEffect[];
}

const TRAJECTORY_HOLD_MIN_MS = 700;
const BANNER_HOLD_FACTOR = 1.1;

export function CourtStage({ frame, previousFrame, transitionDurationMs, madeBasketSide, effects }: CourtStageProps) {
  const { t } = useTranslation();
  const transitionDuration = transitionDurationMs / 1000;
  const [visibleTrajectory, setVisibleTrajectory] = useState<BallTrajectory | null>(null);
  const [visibleBanner, setVisibleBanner] = useState<FrameEffect | null>(null);
  const trajectoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!frame?.trajectory) return;

    startTransition(() => setVisibleTrajectory(frame.trajectory!));
    if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);

    trajectoryTimeoutRef.current = setTimeout(() => {
      startTransition(() => setVisibleTrajectory(null));
      trajectoryTimeoutRef.current = undefined;
    }, transitionDurationMs);
  }, [frame, transitionDurationMs]);

  const primaryEffect = effects?.[0] ?? null;
  const primaryEffectKey = primaryEffect ? `${primaryEffect.kind}-${primaryEffect.sequence}` : null;
  const bannerHoldMs = Math.max(TRAJECTORY_HOLD_MIN_MS, Math.round(transitionDurationMs * BANNER_HOLD_FACTOR));

  useEffect(() => {
    if (!primaryEffect) return;

    setVisibleBanner(primaryEffect);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);

    bannerTimeoutRef.current = setTimeout(() => {
      setVisibleBanner(null);
      bannerTimeoutRef.current = undefined;
    }, bannerHoldMs);
    // The banner only depends on which effect became active, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryEffectKey, bannerHoldMs]);

  useEffect(() => {
    return () => {
      if (trajectoryTimeoutRef.current) clearTimeout(trajectoryTimeoutRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  const hasStamina = frame?.players.some((player) => player.stamina !== undefined && player.stamina !== null) ?? false;
  // Full ball flight for this frame, including shot arcs and the rebound waypoint.
  const flightPath = useMemo(() => (frame ? ballFlightPath(previousFrame, frame) : null), [frame, previousFrame]);

  const trajectory = visibleTrajectory;
  const start = trajectory ? gameToSvg(trajectory.from.x, trajectory.from.y) : null;
  const end = trajectory ? gameToSvg(trajectory.to.x, trajectory.to.y) : null;
  const trajectoryClass = trajectory
    ? trajectory.fromTeam !== trajectory.toTeam
      ? trajectoryStyles.opponentTrajectory
      : trajectoryStyles.sameTeamTrajectory
    : undefined;

  return (
    <div className={styles.stage}>
      <svg
        viewBox="-52 -46 1044 612"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('match_broadcast.simulation.court_label')}
      >
        <Court madeBasketSide={madeBasketSide} />
        {start && end ? (
          <line
            x1={start.cx}
            y1={start.cy}
            x2={end.cx}
            y2={end.cy}
            className={`${trajectoryStyles.trajectory} ${trajectoryClass ?? ''}`.trim()}
          />
        ) : null}
        {frame?.players.map((player) => (
          <Player key={player.id} player={player} transitionDuration={transitionDuration} />
        ))}
        {frame && flightPath ? (
          <Ball path={flightPath} transitionDuration={transitionDuration} isHeld={frame.ball.isHeld ?? false} />
        ) : null}
        {effects && effects.length ? <CourtEffectsSvg effects={effects} /> : null}
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
