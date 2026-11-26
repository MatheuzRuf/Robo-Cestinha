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
import { normalizeShotTarget } from './hooks/ballFlight';
import { oppositeHoopSide } from '../../config/court';
import { CourtStage } from './components/CourtStage/CourtStage';
import type { FrameEffect, HoopSide } from './components/CourtStage/CourtEffects';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { SimulationEvents } from './components/SimulationEvents/SimulationEvents';
import { SimulationProgress } from './components/SimulationProgress/SimulationProgress';
import { CommentaryChat } from './components/CommentaryChat/CommentaryChat';
import { VictoryOverlay } from './components/VictoryOverlay/VictoryOverlay';
import { TrophyShowcase } from '../../components/TrophyShowcase';
import { deriveMatchStats, deriveMatchTrophies } from '../MatchStats/stats';
import { generateCommentaryBatch, type CommentaryFrameResult } from '../../services/commentaryService';
import { buildMatchCommentarySnapshots, FALLBACK_COMMENTARY_LINES } from './commentarySnapshot';
import styles from './MatchBroadcast.module.css';

const DEFAULT_ITERATIONS_LIMIT = 1000;

// Effects that must only fire when the ball physically reaches the rim: an
// intercepted or scored basket is tied to the start of the *following* frame.
const RIM_CONTACT_EVENTS = new Set(['shot_made', 'shot_missed', 'rebound']);

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
  const [isVictoryDismissed, setIsVictoryDismissed] = useState(false);
  const [victoryDelayDone, setVictoryDelayDone] = useState(true);
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
          holderId: simulationFrame.playerWithBallId,
        },
        trajectory: sourceTrajectory
          ? {
              type: sourceTrajectory.type,
              from: sourceTrajectory.fromPosition,
              to:
                sourceTrajectory.type === 'shot'
                  ? normalizeShotTarget(sourceTrajectory.toPosition)
                  : sourceTrajectory.toPosition,
              fromTeam: teamSideFor(sourceTrajectory.fromTeamId),
              toTeam: teamSideFor(sourceTrajectory.toTeamId),
              progress: sourceTrajectory.progress,
            }
          : undefined,
        phase: simulationFrame.phase ?? undefined,
      };
    });
  }, [simulation]);

  const storedPlaybackProgress =
    sessionHash && userId ? getMatchPlaybackProgress({ sessionHash, userId, matchId }) : null;
  const playback = useGameFrames(courtFrames, initialFrameIndex, storedPlaybackProgress?.hasSkippedFrames ?? false);
  const currentSimulationFrame = simulation?.frames[playback.frameIndex] ?? null;
  const previousSimulationFrame =
    playback.frameIndex > 0 ? (simulation?.frames[playback.frameIndex - 1] ?? null) : null;
  const hasWatchedMatch = storedPlaybackProgress?.hasWatched ?? false;
  const hasWatchedThroughEnd = hasWatchedMatch || playback.hasCompletedPlayback;
  const visibleCommentary = currentSimulationFrame
    ? [...commentaryByFrame.entries()]
        .filter(([frame]) => frame <= currentSimulationFrame.iteration)
        .map(([frame, text]) => ({ frame, text }))
    : [];

  useEffect(() => {
    if (playback.isComplete) setIsVictoryDismissed(false);
  }, [playback.isComplete]);

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
    setIsVictoryDismissed(false);
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

  const isFinalFrame = simulation ? playback.frameIndex === simulation.frames.length - 1 : false;
  const frameEffects = useMemo<FrameEffect[]>(() => {
    if (!simulation || !currentSimulationFrame) return [];

    const iteration = currentSimulationFrame.iteration;
    // Rim-mounting events (made baskets, missed shots, rebounds) fire only when
    // the ball actually reaches the basket — i.e. at t=0 of the *following*
    // frame. A final-frame game-winning basket is the one exception: its event
    // lives on the last frame, so include it there so the win still celebrates.
    const frameEvents = simulation.events.filter(
      (event) =>
        event.iteration === iteration &&
        !RIM_CONTACT_EVENTS.has(event.type) &&
        !(isFinalFrame && event.type === 'shot_made'),
    );
    const finalFrameMadeShots = isFinalFrame
      ? simulation.events.filter((event) => event.iteration === iteration && event.type === 'shot_made')
      : [];
    const priorRimEvents =
      iteration > 0
        ? simulation.events.filter(
            (event) => event.iteration === iteration - 1 && RIM_CONTACT_EVENTS.has(event.type),
          )
        : [];
    const events = [...frameEvents, ...priorRimEvents, ...finalFrameMadeShots];
    if (!events.length) return [];

    const interceptIterations = new Set(
      simulation.events.filter((event) => event.type === 'pass_intercepted').map((event) => event.iteration),
    );
    const playersById = new Map(simulation.players.map((player) => [player.playerId, player]));
    const positionsById = new Map(currentSimulationFrame.players.map((position) => [position.playerId, position]));
    const previousPositionsById = new Map(
      (previousSimulationFrame?.players ?? []).map((position) => [position.playerId, position]),
    );
    const homeTeamId = simulation.teams.home.teamId;
    const hoopSideFor = (teamId: string | null): HoopSide => (teamId === homeTeamId ? 'right' : 'left');
    const teamSideFor = (teamId: string | null): 'home' | 'away' => (teamId === homeTeamId ? 'home' : 'away');
    const abbreviationFor = (teamId: string | null) =>
      teamId === homeTeamId ? simulation.teams.home.abbreviation : simulation.teams.away.abbreviation;
    const sideOf = (playerId: string | null | undefined): 'home' | 'away' =>
      playerId ? (playersById.get(playerId)?.side ?? 'away') : 'away';
    const abbreviationOf = (playerId: string | null | undefined): string => {
      const side = sideOf(playerId);
      return (side === 'home' ? simulation.teams.home : simulation.teams.away).abbreviation;
    };
    const shortNameFor = (name: string | undefined) => {
      const parts = (name ?? '').trim().split(/\s+/);
      if (!parts[0]) return '';
      return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : parts[0];
    };
    const playerPos = (playerId: string | null | undefined) => {
      if (!playerId) return null;
      const position = positionsById.get(playerId) ?? previousPositionsById.get(playerId);
      return position ? { x: position.x, y: position.y } : null;
    };

    const effects: FrameEffect[] = [];
    for (const event of events) {
      const eventIter = event.iteration;
      if (event.type === 'shot_made') {
        const shooter = event.playerId ? playersById.get(event.playerId) : undefined;
        // On the kickoff frame (K+1) players have already moved toward kickoff
        // slots; look the shooter up from the previous frame first.
        const shooterPosition = event.playerId
          ? (eventIter === iteration
              ? positionsById.get(event.playerId)
              : (previousPositionsById.get(event.playerId) ?? positionsById.get(event.playerId)))
          : undefined;
        const points = Number(event.data.pointsScored ?? event.data.shotValue ?? 2);
        const assistName = event.targetPlayerId
          ? shortNameFor(playersById.get(event.targetPlayerId)?.name)
          : null;
        effects.push({
          kind: 'score',
          sequence: event.sequence,
          points: points === 3 ? 3 : 2,
          hoopSide: hoopSideFor(event.teamId),
          teamSide: teamSideFor(event.teamId),
          shooterId: shooter?.playerId ?? null,
          shooterName: shortNameFor(shooter?.name),
          shooterPos: shooterPosition ? { x: shooterPosition.x, y: shooterPosition.y } : null,
          teamAbbreviation: abbreviationFor(event.teamId),
          assistName,
        });
      } else if (event.type === 'rebound') {
        const rebounder = event.playerId ? playersById.get(event.playerId) : undefined;
        const reboundType = event.data.reboundType === 'offensive' ? 'offensive' : 'defensive';
        const rebounderPosition = event.playerId
          ? (previousPositionsById.get(event.playerId) ?? positionsById.get(event.playerId))
          : undefined;
        const teamOffensiveHoop = hoopSideFor(event.teamId);
        effects.push({
          kind: 'rebound',
          sequence: event.sequence,
          reboundType,
          teamSide: teamSideFor(event.teamId),
          playerId: rebounder?.playerId ?? null,
          playerName: shortNameFor(rebounder?.name),
          playerPos: rebounderPosition ? { x: rebounderPosition.x, y: rebounderPosition.y } : null,
          hoopSide: reboundType === 'offensive' ? teamOffensiveHoop : oppositeHoopSide(teamOffensiveHoop),
          teamAbbreviation: abbreviationFor(event.teamId),
        });
      } else if (event.type === 'shot_missed') {
        effects.push({
          kind: 'miss',
          sequence: event.sequence,
          hoopSide: hoopSideFor(event.teamId),
        });
      } else if (event.type === 'turnover' && event.targetPlayerId && !interceptIterations.has(iteration)) {
        // On-ball steal (no pass interception on the same iteration).
        const defenderId = event.targetPlayerId;
        const defenderName = shortNameFor(playersById.get(defenderId)?.name);
        effects.push({
          kind: 'steal',
          sequence: event.sequence,
          teamSide: sideOf(defenderId),
          defenderId,
          defenderName,
          defenderPos: playerPos(defenderId),
          victimName: shortNameFor(playersById.get(event.playerId ?? '')?.name),
          teamAbbreviation: abbreviationOf(defenderId),
        });
      } else if (event.type === 'pass_intercepted' && event.targetPlayerId) {
        const defenderId = event.targetPlayerId;
        const defenderName = shortNameFor(playersById.get(defenderId)?.name);
        effects.push({
          kind: 'intercept',
          sequence: event.sequence,
          teamSide: sideOf(defenderId),
          defenderId,
          defenderName,
          defenderPos: playerPos(defenderId),
          passerName: shortNameFor(playersById.get(event.playerId ?? '')?.name),
          teamAbbreviation: abbreviationOf(defenderId),
        });
      } else if (event.type === 'foul') {
        effects.push({
          kind: 'foul',
          sequence: event.sequence,
          teamSide: sideOf(event.playerId),
          playerId: event.playerId ?? null,
          playerName: shortNameFor(playersById.get(event.playerId ?? '')?.name),
          playerPos: playerPos(event.playerId),
          defenderName: event.targetPlayerId
            ? shortNameFor(playersById.get(event.targetPlayerId)?.name)
            : null,
          teamAbbreviation: abbreviationOf(event.playerId),
        });
      }
    }
    return effects;
  }, [simulation, currentSimulationFrame, previousSimulationFrame, isFinalFrame]);

  const madeBasketSide = frameEffects.find((effect) => effect.kind === 'score')?.hoopSide;

  // While the winning shot is still in flight on the final frame, delay showing
  // VictoryOverlay until the viewer watches the ball arc into the hoop.
  const hasFinalFrameMadeShot = isFinalFrame
    ? Boolean(
        currentSimulationFrame &&
          simulation?.events.some(
            (event) => event.iteration === currentSimulationFrame.iteration && event.type === 'shot_made',
          ),
      )
    : false;
  useEffect(() => {
    if (!hasFinalFrameMadeShot) return;
    setVictoryDelayDone(false);
    const id = window.setTimeout(
      () => setVictoryDelayDone(true),
      Math.round(playback.transitionDurationMs + 450),
    );
    return () => window.clearTimeout(id);
  }, [hasFinalFrameMadeShot, playback.transitionDurationMs]);

  // No mid-flight score spoilers: while a made shot is still travelling (the
  // shot frame), hold the previous frame's score so it pops at rim contact.
  const hasInFlightMadeShot =
    !isFinalFrame &&
    Boolean(
      currentSimulationFrame &&
        simulation?.events.some(
          (event) =>
            event.iteration === currentSimulationFrame.iteration && event.type === 'shot_made',
        ),
    );
  const displayedScore =
    hasInFlightMadeShot && previousSimulationFrame ? previousSimulationFrame.score : (currentSimulationFrame?.score ?? null);

  const matchStats = useMemo(() => (simulation ? deriveMatchStats(simulation) : null), [simulation]);
  const matchTrophies = useMemo(
    () => (simulation && matchStats ? deriveMatchTrophies(simulation, matchStats) : []),
    [simulation, matchStats],
  );

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
            homeScore={displayedScore?.home ?? 0}
            awayScore={displayedScore?.away ?? 0}
            possessionTeamId={currentSimulationFrame.possessionTeamId}
            frameNumber={playback.frameIndex + 1}
            speed={playback.speed}
            setSpeed={playback.setSpeed}
            isComplete={playback.isComplete}
            isPaused={playback.isPaused}
            isFullMode={isFullMode}
            onToggleFullMode={toggleFullMode}
          />
          <section className={styles.broadcastMainGrid}>
            <div className={styles.centerColumn}>
              <div className={styles.courtStageWrap}>
                <CourtStage
                  frame={playback.frame}
                  previousFrame={courtFrames[playback.frameIndex - 1] ?? null}
                  transitionDurationMs={playback.transitionDurationMs}
                  madeBasketSide={madeBasketSide}
                  effects={frameEffects}
                />
                {playback.isComplete && victoryDelayDone && !isVictoryDismissed && simulation.summary.winnerTeamId ? (
                  <VictoryOverlay
                    homeTeam={simulation.teams.home}
                    awayTeam={simulation.teams.away}
                    homeScore={simulation.summary.homeScore}
                    awayScore={simulation.summary.awayScore}
                    winnerTeamId={simulation.summary.winnerTeamId}
                    isOvertime={simulation.simulation.overtimeIterations > 0}
                    trophiesSlot={
                      matchTrophies.length ? (
                        <TrophyShowcase trophies={matchTrophies.slice(0, 4)} variant="compact" />
                      ) : null
                    }
                    onViewStats={() => navigate(`/matches/${matchId}/stats`)}
                    onReplay={restartPlayback}
                    onBackToBracket={() => navigate('/bracket-tree')}
                    onDismiss={() => setIsVictoryDismissed(true)}
                  />
                ) : null}
              </div>
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
              {playback.isComplete ? (
                <div className={styles.matchStatsAction}>
                  {isVictoryDismissed ? (
                    <Button variant="outline" onClick={() => setIsVictoryDismissed(false)}>
                      {t('match_broadcast.victory.show_summary')}
                    </Button>
                  ) : null}
                  {hasWatchedThroughEnd ? (
                    <Button variant="primary" onClick={() => navigate(`/matches/${matchId}/stats`)}>
                      {t('match_broadcast.simulation.view_stats')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {isFullMode ? null : (
              <aside className={styles.broadcastSidebar}>
                <SimulationEvents
                  events={simulation.events}
                  players={simulation.players}
                  teams={simulation.teams}
                  currentIteration={currentSimulationFrame.iteration}
                  isLastFrame={playback.isComplete}
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
