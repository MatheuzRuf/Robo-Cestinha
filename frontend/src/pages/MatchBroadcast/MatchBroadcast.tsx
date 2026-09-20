import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useGameFrames } from '../../hooks/useGameFrames';
import { BroadcastHeader } from './components/BroadcastHeader/BroadcastHeader';
import { CommentaryColumn } from './components/CommentaryColumn/CommentaryColumn';
import { CourtStage } from './components/CourtStage/CourtStage';
import { MomentumShiftEngine } from './components/MomentumShiftEngine/MomentumShiftEngine';
import { PlayByPlayColumn } from './components/PlayByPlayColumn/PlayByPlayColumn';
import { PlayCallStrip } from './components/PlayCallStrip/PlayCallStrip';
import { Scoreboard } from './components/Scoreboard/Scoreboard';
import { TimelineScrubber } from './components/TimelineScrubber/TimelineScrubber';
import { mockMatchData } from './data/mockMatchData';
import styles from './MatchBroadcast.module.css';

export default function MatchBroadcast() {
  const { frame, transitionDurationMs, speed, setSpeed, isPaused, pause, resume } = useGameFrames();
  const [playByPlay, setPlayByPlay] = useState(mockMatchData.playByPlay);
  const [commentary, setCommentary] = useState(mockMatchData.commentary);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (isPaused) return;

      const timestamp = Date.now();

      setPlayByPlay((entries) =>
        [
          ...entries,
          {
            id: `play-${timestamp}`,
            gameClock: '[01:18 Q4]',
            type: 'POSSESSION',
            description: 'Chicago controls the tempo in the closing stretch.',
          },
        ].slice(-50),
      );
      setCommentary((entries) =>
        [
          ...entries,
          {
            id: `commentary-${timestamp}`,
            gameClock: '[01:18 Q4]',
            text: 'Chicago is managing the clock with the confidence of a team that has been here before.',
          },
        ].slice(-50),
      );
    }, 12000);

    return () => window.clearInterval(id);
  }, [isPaused]);

  return (
    <AppShell activeNavItem="liveBroadcast" tickerText={mockMatchData.ticker}>
      <main className={styles.page}>
        <BroadcastHeader />
        <Scoreboard speed={speed} setSpeed={setSpeed} isPaused={isPaused} onTogglePause={isPaused ? resume : pause} />
        <section className={styles.broadcastMainGrid}>
          <section className={styles.sideColumn}>
            <PlayByPlayColumn entries={playByPlay} />
          </section>
          <section className={styles.centerColumn}>
            <CourtStage frame={frame} transitionDurationMs={transitionDurationMs} />
            <PlayCallStrip />
            <TimelineScrubber />
            <MomentumShiftEngine />
          </section>
          <section className={styles.sideColumn}>
            <CommentaryColumn entries={commentary} isPaused={isPaused} />
          </section>
        </section>
      </main>
    </AppShell>
  );
}
