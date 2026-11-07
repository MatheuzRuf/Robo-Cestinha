import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { simulationService } from '../../services/simulationService';
import { useSessionStore } from '../../stores/sessionStore';
import { useTranslation } from '../../lib/i18n/i18n';
import type { PlayerState, Team } from '../../types/game';
import type { SimulationResponse } from '../../types/matchBroadcast';
import { useGameFrames } from './hooks/useGameFrames';
import { CourtStage } from './components/CourtStage/CourtStage';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { SimulationEvents } from './components/SimulationEvents/SimulationEvents';
import { SimulationProgress } from './components/SimulationProgress/SimulationProgress';
import styles from './MatchBroadcast.module.css';

const DEFAULT_ITERATIONS_LIMIT = 1000;

export default function MatchBroadcast() {
  const { matchId: routeMatchId } = useParams();
  const matchId = routeMatchId ?? 'demo';
  const sessionHash = useSessionStore((state) => state.activeSessionHash);
  const { t } = useTranslation();
  const requestController = useRef<AbortController | null>(null);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);

  const loadSimulation = useCallback(async () => {
    requestController.current?.abort();
    requestController.current = null;

    if (!sessionHash) {
      setSimulation(null);
      setIsPending(false);
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setIsPending(true);
    setError(null);

    try {
      const stored = await simulationService.getSimulation({
        matchId,
        sessionHash,
        signal: controller.signal,
      });
      const data =
        stored ??
        (await simulationService.runSimulation({
          matchId,
          sessionHash,
          iterations: DEFAULT_ITERATIONS_LIMIT,
          signal: controller.signal,
        }));
      if (controller.signal.aborted) return;
      setSimulation(data);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setSimulation(null);
      setError(cause instanceof Error ? cause.message : 'Simulation request failed');
    } finally {
      if (!controller.signal.aborted) setIsPending(false);
    }
  }, [matchId, sessionHash]);

  useEffect(() => {
    void loadSimulation();
    return () => {
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [loadSimulation]);

  const courtFrames = useMemo(() => {
    if (!simulation) return [];

    const playersById = new Map(simulation.players.map((player) => [player.playerId, player]));
    const teamSideFor = (teamId: string): Team => (teamId === simulation.teams.home.teamId ? 'home' : 'away');
    return simulation.frames.map((simulationFrame) => {
      const positionsById = new Map(simulationFrame.players.map((position) => [position.playerId, position]));
      const holderPosition = simulationFrame.playerWithBallId
        ? positionsById.get(simulationFrame.playerWithBallId)
        : undefined;
      const sourceTrajectory = simulationFrame.ball.trajectory;

      return {
        players: simulationFrame.players.flatMap((position): PlayerState[] => {
          const player = playersById.get(position.playerId);
          if (!player) return [];

          return [
            {
              id: player.playerId,
              team: player.side,
              x: position.x,
              y: position.y,
              name: player.name,
              number: player.number ?? undefined,
              position: player.position,
            },
          ];
        }),
        ball: {
          x: holderPosition?.x ?? simulationFrame.ball.x,
          y: holderPosition?.y ?? simulationFrame.ball.y,
          height: simulationFrame.ball.height ?? 0,
        },
        trajectory: sourceTrajectory
          ? {
              type: sourceTrajectory.type,
              from: sourceTrajectory.fromPosition,
              to: sourceTrajectory.toPosition,
              fromTeam: teamSideFor(sourceTrajectory.fromTeamId),
              toTeam: teamSideFor(sourceTrajectory.toTeamId),
              progress: sourceTrajectory.progress,
            }
          : undefined,
      };
    });
  }, [simulation]);

  const playback = useGameFrames(courtFrames);
  const currentSimulationFrame = simulation?.frames[playback.frameIndex] ?? null;
  const currentBasketEvent = simulation?.events.find(
    (event) => event.type === 'shot_made' && event.iteration === currentSimulationFrame?.iteration,
  );
  const basketSide = currentBasketEvent
    ? currentBasketEvent.teamId === simulation?.teams.home.teamId
      ? 'right'
      : 'left'
    : undefined;

  return (
    <main className={styles.page}>
      {!sessionHash ? (
        <div className={styles.statusMessage} role="status">
          {t('match_broadcast.simulation.no_active_session')}
        </div>
      ) : isPending ? (
        <div className={styles.statusMessage} role="status">
          {t('match_broadcast.simulation.loading')}
        </div>
      ) : error || !simulation || !currentSimulationFrame || !playback.frame ? (
        <div className={styles.errorState} role="alert">
          <p>{t('match_broadcast.simulation.error')}</p>
          <Button variant="outline" onClick={() => void loadSimulation()}>
            {t('match_broadcast.simulation.retry')}
          </Button>
        </div>
      ) : (
        <>
          <Scoreboard
            homeTeam={simulation.teams.home}
            awayTeam={simulation.teams.away}
            homeScore={currentSimulationFrame.score.home}
            awayScore={currentSimulationFrame.score.away}
            possessionTeamId={currentSimulationFrame.possessionTeamId}
            frameNumber={playback.frameIndex + 1}
            totalFrames={simulation.frames.length}
            speed={playback.speed}
            setSpeed={playback.setSpeed}
            isPaused={playback.isPaused}
            isComplete={playback.isComplete}
            onTogglePause={playback.isPaused ? playback.resume : playback.pause}
            onRestart={playback.restart}
          />
          <section className={styles.broadcastMainGrid}>
            <div className={styles.centerColumn}>
              <CourtStage
                frame={playback.frame}
                transitionDurationMs={playback.transitionDurationMs}
                basketMessage={
                  currentBasketEvent
                    ? t('match_broadcast.simulation.basket_made', {
                        points: Number(currentBasketEvent.data.pointsScored ?? 2),
                      })
                    : undefined
                }
                basketSequence={currentBasketEvent?.sequence}
                madeBasketSide={basketSide}
              />
              <SimulationProgress currentFrame={playback.frameIndex + 1} totalFrames={simulation.frames.length} />
            </div>
            <SimulationEvents
              events={simulation.events}
              players={simulation.players}
              currentIteration={currentSimulationFrame.iteration}
            />
          </section>
        </>
      )}
    </main>
  );
}
