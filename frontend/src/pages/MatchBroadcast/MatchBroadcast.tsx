import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { useMatchBroadcastStore } from '../../stores/matchBroadcastStore';
import { matchBroadcastService } from '../../services/matchBroadcastService';
import { useTranslation } from '../../lib/i18n/i18n';
import { useGameFrames } from './hooks/useGameFrames';
import { BroadcastHeader } from './components/BroadcastHeader/BroadcastHeader';
import { CommentaryColumn } from './components/CommentaryColumn/CommentaryColumn';
import { CourtStage } from './components/CourtStage/CourtStage';
import { MomentumShiftEngine } from './components/MomentumShiftEngine/MomentumShiftEngine';
import { PlayByPlayColumn } from './components/PlayByPlayColumn/PlayByPlayColumn';
import { PlayCallStrip } from './components/PlayCallStrip/PlayCallStrip';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { TimelineScrubber } from './components/TimelineScrubber/TimelineScrubber';
import styles from './MatchBroadcast.module.css';

interface MatchBroadcastProps {
  matchId?: string;
}

export default function MatchBroadcast({ matchId: providedMatchId }: MatchBroadcastProps) {
  const { matchId: routeMatchId } = useParams();
  const matchId = providedMatchId ?? routeMatchId ?? 'demo';
  const { t } = useTranslation();
  const snapshot = useMatchBroadcastStore((state) => state.snapshot);
  const streamFrame = useMatchBroadcastStore((state) => state.frame);
  const playByPlay = useMatchBroadcastStore((state) => state.playByPlay);
  const commentary = useMatchBroadcastStore((state) => state.commentary);
  const status = useMatchBroadcastStore((state) => state.status);
  const reset = useMatchBroadcastStore((state) => state.reset);
  const { frame, transitionDurationMs, speed, setSpeed, isPaused, pause, resume } = useGameFrames(streamFrame);

  useEffect(() => {
    reset(matchId);
    const disconnect = matchBroadcastService.connect(
      matchId,
      (event) => useMatchBroadcastStore.getState().receiveEvent(event),
      (nextStatus) => useMatchBroadcastStore.getState().setStatus(nextStatus),
    );

    return () => {
      disconnect();
      useMatchBroadcastStore.getState().setStatus('idle');
    };
  }, [matchId, reset]);

  const statusKey =
    status === 'connected'
      ? 'connected'
      : status === 'reconnecting'
        ? 'reconnecting'
        : status === 'error'
          ? 'error'
          : 'connecting';

  return (
    <AppShell activeNavItem="liveBroadcast" tickerText={snapshot?.ticker}>
      <main className={styles.page}>
        <BroadcastHeader matchMeta={snapshot?.matchMeta} status={status} />
        {snapshot ? (
          <>
            <Scoreboard
              snapshot={snapshot}
              speed={speed}
              setSpeed={setSpeed}
              isPaused={isPaused}
              onTogglePause={isPaused ? resume : pause}
            />
            <section className={styles.broadcastMainGrid}>
              <section className={styles.sideColumn}>
                <PlayByPlayColumn entries={playByPlay} />
              </section>
              <section className={styles.centerColumn}>
                <CourtStage frame={frame} transitionDurationMs={transitionDurationMs} />
                <PlayCallStrip
                  playCall={snapshot.playCall}
                  shotProbability={snapshot.shotProbability}
                  defensiveScheme={snapshot.defensiveScheme}
                />
                <TimelineScrubber
                  quarter={snapshot.quarter}
                  elapsedSeconds={snapshot.elapsedSeconds}
                  durationSeconds={snapshot.durationSeconds}
                />
                <MomentumShiftEngine
                  momentum={snapshot.momentum}
                  homeName={snapshot.home.name}
                  awayName={snapshot.away.name}
                />
              </section>
              <section className={styles.sideColumn}>
                <CommentaryColumn entries={commentary} isPaused={isPaused} />
              </section>
            </section>
          </>
        ) : (
          <div className={styles.streamStatus} role="status">
            {t(`match_broadcast.header.${statusKey}`)}
          </div>
        )}
      </main>
    </AppShell>
  );
}
