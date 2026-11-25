import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { simulationService } from '../../services/simulationService';
import { useSessionStore } from '../../stores/sessionStore';
import { useTranslation } from '../../lib/i18n/i18n';
import { getMatchPlaybackProgress, saveMatchPlaybackProgress } from '../../lib/storage/matchPlaybackProgress';
import type { PlayerState, Team } from '../../types/game';
import type { SimulationResponse } from '../../types/matchBroadcast';
import { useGameFrames } from './hooks/useGameFrames';
import { CourtStage } from './components/CourtStage/CourtStage';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { SimulationEvents } from './components/SimulationEvents/SimulationEvents';
import { SimulationProgress } from './components/SimulationProgress/SimulationProgress';
import { CommentaryChat } from './components/CommentaryChat/CommentaryChat';
import { generateCommentaryBatch, type CommentaryFrameResult } from '../../services/commentaryService';
import { buildMatchCommentarySnapshots, FALLBACK_COMMENTARY_LINES } from './commentarySnapshot';
import styles from './MatchBroadcast.module.css';

const DEFAULT_ITERATIONS_LIMIT = 1000;

export default function MatchBroadcast() {
  const { matchId: routeMatchId } = useParams();
  const navigate = useNavigate();
  const matchId = routeMatchId ?? '';
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const sessionHash = activeSession?.sessionHash ?? null;
  const userId = activeSession?.userId ?? null;
  const { t } = useTranslation();
  const requestController = useRef<AbortController | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [initialFrameIndex, setInitialFrameIndex] = useState(0);
  const [isFullMode, setIsFullMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isPreparingCommentary, setIsPreparingCommentary] = useState(false);
  const [commentaryByFrame, setCommentaryByFrame] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    const syncFullMode = () => setIsFullMode(document.fullscreenElement === pageRef.current);
    document.addEventListener('fullscreenchange', syncFullMode);
    return () => document.removeEventListener('fullscreenchange', syncFullMode);
  }, []);

  const toggleFullMode = useCallback(async () => {
    const page = pageRef.current;
    if (!page) return;

    try {
      if (document.fullscreenElement === page) {
        await document.exitFullscreen();
      } else {
        await page.requestFullscreen();
      }
    } catch {
      setIsFullMode(document.fullscreenElement === page);
    }
  }, []);

  const loadSimulation = useCallback(async () => {
    requestController.current?.abort();
    requestController.current = null;

    if (!sessionHash || !userId) {
      setIsPending(false);
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setIsPending(true);
    setSimulation(null);
    setInitialFrameIndex(0);
    setIsPreparingCommentary(false);
    setError(null);
    setCommentaryByFrame(new Map());

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
      const commentarySnapshots = buildMatchCommentarySnapshots(data);
      setIsPreparingCommentary(commentarySnapshots.length > 0);
      let generatedCommentary: CommentaryFrameResult[] = [];
      try {
        generatedCommentary = await generateCommentaryBatch(commentarySnapshots, controller.signal);
      } catch {
        if (controller.signal.aborted) return;
      }
      if (controller.signal.aborted) return;

      const commentary = new Map<number, string>();
      const resultByFrame = new Map(generatedCommentary.map((result) => [result.f, result.c]));
      const totalFrames = Math.max(1, data.frames.length - 1);
      for (const snapshot of commentarySnapshots) {
        const generated = resultByFrame.get(snapshot.f)?.trim();
        if (generated) {
          commentary.set(snapshot.f, generated);
        } else if (snapshot.f >= Math.ceil(totalFrames * 0.9)) {
          commentary.set(
            snapshot.f,
            FALLBACK_COMMENTARY_LINES[Math.floor(Math.random() * FALLBACK_COMMENTARY_LINES.length)],
          );
        }
      }

      const progress = getMatchPlaybackProgress({ sessionHash, userId, matchId });
      const savedIterationIndex = progress
        ? data.frames.findIndex((frame) => frame.iteration === progress.iteration)
        : -1;
      const restoredFrameIndex = savedIterationIndex >= 0 ? savedIterationIndex : (progress?.frameIndex ?? 0);
      setCommentaryByFrame(commentary);
      setInitialFrameIndex(Math.min(Math.max(0, restoredFrameIndex), data.frames.length - 1));
      setSimulation(data);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setSimulation(null);
      setError(cause instanceof Error ? cause.message : 'Simulation request failed');
    } finally {
      if (!controller.signal.aborted) {
        setIsPreparingCommentary(false);
        setIsPending(false);
      }
    }
  }, [matchId, sessionHash, userId]);

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
              nbaPlayerId: player.nbaPlayerId,
              number: player.number ?? undefined,
              position: player.position,
              stamina: position.stamina ?? undefined,
            },
          ];
        }),
        ball: {
          x: holderPosition?.x ?? simulationFrame.ball.x,
          y: holderPosition?.y ?? simulationFrame.ball.y,
          height: simulationFrame.ball.height ?? 0,
          isHeld: Boolean(simulationFrame.playerWithBallId && !sourceTrajectory),
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

  const storedPlaybackProgress =
    sessionHash && userId ? getMatchPlaybackProgress({ sessionHash, userId, matchId }) : null;
  const playback = useGameFrames(courtFrames, initialFrameIndex, storedPlaybackProgress?.hasSkippedFrames ?? false);
  const currentSimulationFrame = simulation?.frames[playback.frameIndex] ?? null;
  const hasWatchedMatch = storedPlaybackProgress?.hasWatched ?? false;
  const hasWatchedThroughEnd = hasWatchedMatch || playback.hasCompletedPlayback;
  const visibleCommentary = currentSimulationFrame
    ? [...commentaryByFrame.entries()]
        .filter(([frame]) => frame <= currentSimulationFrame.iteration)
        .map(([frame, text]) => ({ frame, text }))
    : [];

  useEffect(() => {
    if (!sessionHash || !userId || !simulation || !currentSimulationFrame) return;

    saveMatchPlaybackProgress(
      { sessionHash, userId, matchId },
      {
        frameIndex: playback.frameIndex,
        iteration: currentSimulationFrame.iteration,
        isComplete: playback.isComplete,
        hasWatched: hasWatchedThroughEnd,
        hasSkippedFrames: playback.hasSkippedFrames,
      },
    );
  }, [
    currentSimulationFrame,
    hasWatchedThroughEnd,
    matchId,
    playback.frameIndex,
    playback.hasCompletedPlayback,
    playback.hasSkippedFrames,
    playback.isComplete,
    sessionHash,
    simulation,
    userId,
  ]);

  function restartPlayback() {
    playback.restart();
    const firstFrame = simulation?.frames[0];
    if (!sessionHash || !userId || !firstFrame) return;

    saveMatchPlaybackProgress(
      { sessionHash, userId, matchId },
      {
        frameIndex: 0,
        iteration: firstFrame.iteration,
        isComplete: false,
        hasWatched: hasWatchedThroughEnd,
        hasSkippedFrames: false,
      },
    );
  }

  const currentBasketEvent = simulation?.events.find(
    (event) => event.type === 'shot_made' && event.iteration === currentSimulationFrame?.iteration,
  );
  const basketSide = currentBasketEvent
    ? currentBasketEvent.teamId === simulation?.teams.home.teamId
      ? 'right'
      : 'left'
    : undefined;

  return (
    <main className={`${styles.page} ${styles.matchPage}`} ref={pageRef}>
      {!sessionHash || !userId ? (
        <div className={styles.statusMessage} role="status">
          {t('match_broadcast.simulation.no_active_session')}
        </div>
      ) : isPending ? (
        <div className={styles.statusMessage} role="status">
          {t(
            isPreparingCommentary
              ? 'match_broadcast.simulation.preparing_commentary'
              : 'match_broadcast.simulation.loading',
          )}
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
            isComplete={playback.isComplete}
            isFullMode={isFullMode}
            onToggleFullMode={toggleFullMode}
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
              <SimulationProgress
                currentFrame={playback.frameIndex + 1}
                totalFrames={simulation.frames.length}
                isPaused={playback.isPaused}
                isComplete={playback.isComplete}
                onSeek={playback.seek}
                onSeekStart={playback.beginSeeking}
                onSeekEnd={playback.endSeeking}
                onTogglePause={playback.isPaused ? playback.resume : playback.pause}
                onRestart={restartPlayback}
              />
              {playback.isComplete && hasWatchedThroughEnd ? (
                <div className={styles.matchStatsAction}>
                  <Button variant="primary" onClick={() => navigate(`/matches/${matchId}/stats`)}>
                    {t('match_broadcast.simulation.view_stats')}
                  </Button>
                </div>
              ) : null}
            </div>
            {isFullMode ? null : (
              <aside className={styles.broadcastSidebar}>
                <SimulationEvents
                  events={simulation.events}
                  players={simulation.players}
                  currentIteration={currentSimulationFrame.iteration}
                />
                <CommentaryChat
                  messages={visibleCommentary}
                  currentFrame={currentSimulationFrame.iteration}
                  isTyping={false}
                />
              </aside>
            )}
          </section>
        </>
      )}
    </main>
  );
}
