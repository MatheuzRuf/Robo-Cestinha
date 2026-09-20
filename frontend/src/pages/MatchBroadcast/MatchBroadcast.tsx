import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusBadge } from '../../components/StatusBadge';
import { useGameFrames } from '../../hooks/useGameFrames';
import { useTranslation } from '../../lib/i18n/i18n';
import { CourtStage } from './components/CourtStage/CourtStage';
import { BroadcastLogPanel } from './components/BroadcastLogPanel/BroadcastLogPanel';
import styles from './MatchBroadcast.module.css';

type Speed = 1 | 1.5 | 2;

const mockMatchData = {
  ticker: 'COURT 01: CHICAGO STEEL LEAD BROOKLYN BREAKERS 86-80 (Q4 01:36) // LIVE SIMULATION ACTIVE',
  gameMeta: 'DIVISION A CHAMPIONSHIP SERIES · GAME 7',
  home: {
    abbreviation: 'CS',
    name: 'CHICAGO STEEL',
    score: 86,
    seed: 'SEED #1',
    possession: true,
    fouls: { current: 3, max: 5 },
    timeouts: { remaining: 1, total: 3 },
  },
  away: {
    abbreviation: 'BB',
    name: 'BROOKLYN BREAKERS',
    score: 80,
    seed: 'SEED #2',
    possession: false,
    fouls: { current: 4, max: 5 },
    timeouts: { remaining: 2, total: 3 },
  },
  playCall: 'HORNS CORNER SNAP',
  shotProbability: 68,
  defensiveScheme: '2-3 DROP ZONE',
  quarter: '4TH QUARTER',
  gameClock: '01:36',
  shotClock: '08',
  commentary: [
    {
      id: 'commentary-1',
      gameClock: '[01:42 Q4]',
      text: 'Steel are slowing the floor and forcing Brooklyn to defend every possession.',
    },
    { id: 'commentary-2', gameClock: '[01:51 Q4]', text: 'That is textbook late-game execution from Chicago.' },
    { id: 'commentary-3', gameClock: '[02:04 Q4]', text: 'The next stop could decide the entire championship series.' },
  ],
  playByPlay: [
    { id: '1', gameClock: '[01:42 Q4]', type: '3-POINT ATTEMPT', description: 'M. Carter misses from the left wing.' },
    { id: '2', gameClock: '[01:51 Q4]', type: 'REBOUND', description: 'J. Brooks secures the defensive rebound.' },
    { id: '3', gameClock: '[02:04 Q4]', type: 'PERSONAL FOUL', description: 'Brooklyn called for a reach-in foul.' },
    { id: '4', gameClock: '[02:18 Q4]', type: 'STEAL', description: 'R. Ellis jumps the passing lane.' },
    { id: '5', gameClock: '[02:32 Q4]', type: '2-POINT MADE', description: 'A. Reed finishes through contact.' },
  ],
  momentum: {
    runLabel: '2-MINUTE CLUTCH RUN',
    runDelta: '+6 CHICAGO RUN',
    homePoints: 6,
    awayPoints: 0,
    stats: [
      ['FG%', '54.2'],
      ['PAINT PTS', '38'],
      ['FAST BREAK PTS', '12'],
    ],
  },
};

type TeamSummary = typeof mockMatchData.home;
type PlayByPlayLogEntry = (typeof mockMatchData.playByPlay)[number];
type CommentaryEntry = (typeof mockMatchData.commentary)[number];

function BroadcastHeader() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('live');
  return (
    <section className={styles.broadcastHeader}>
      <div className={styles.headerIdentity}>
        <StatusBadge tone="live" icon="●">
          {t('match_broadcast.header.live_label')}
        </StatusBadge>
        <span>{t('match_broadcast.header.game_meta')}</span>
      </div>
      <div className={styles.headerControls}>
        <SegmentedControl
          label=""
          options={[
            { value: 'live', label: t('match_broadcast.header.mode_live') },
            { value: 'replay', label: t('match_broadcast.header.mode_replay') },
          ]}
          value={mode}
          onChange={setMode}
          disabledValues={['replay']}
        />
        <span className={styles.latency}>{t('match_broadcast.header.latency_label', { value: 18 })}</span>
      </div>
    </section>
  );
}

function TeamSummary({ side, team }: { side: 'home' | 'away'; team: TeamSummary }) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.teamSummary} ${side === 'away' ? styles.awaySummary : ''}`}>
      <div className={styles.teamCopy}>
        <span className={styles.seed}>{team.seed}</span>
        <strong>{team.name}</strong>
        <span className={styles.teamMeta}>
          {team.possession ? '◀ ' : ''}
          {team.abbreviation}
        </span>
      </div>
      <strong className={styles.score}>{team.score}</strong>
      <span className={styles.teamStats}>
        {t('match_broadcast.scoreboard.fouls_label')}{' '}
        <b>
          {team.fouls.current}/{team.fouls.max}
        </b>{' '}
        · {t('match_broadcast.scoreboard.timeouts_label')}{' '}
        <b>
          {team.timeouts.remaining}/{team.timeouts.total}
        </b>
      </span>
    </div>
  );
}

function CompactScoreboardBar({
  speed,
  setSpeed,
  isPaused,
  onTogglePause,
}: {
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isPaused: boolean;
  onTogglePause: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.scoreboard}>
      <TeamSummary side="home" team={mockMatchData.home} />
      <div className={styles.clockPanel}>
        <span className={styles.quarter}>{mockMatchData.quarter}</span>
        <strong className={styles.gameClock}>{mockMatchData.gameClock}</strong>
        <span className={styles.shotClock}>
          {t('match_broadcast.clock.shot_clock')} <b>{mockMatchData.shotClock}</b>
        </span>
        <SegmentedControl
          label={t('match_broadcast.clock.speed_label')}
          options={[
            { value: '1', label: '1.0X' },
            { value: '1.5', label: '1.5X' },
            { value: '2', label: '2.0X' },
          ]}
          value={String(speed)}
          onChange={(value) => setSpeed(Number(value) as Speed)}
        />
        <Button variant="outline" onClick={onTogglePause}>
          {isPaused ? t('match_broadcast.clock.resume') : t('match_broadcast.clock.pause')}
        </Button>
      </div>
      <TeamSummary side="away" team={mockMatchData.away} />
    </section>
  );
}

function PlayCallStrip() {
  const { t } = useTranslation();
  return (
    <section className={styles.playCall}>
      <span>
        <b>{t('match_broadcast.play_call.label')}</b> {mockMatchData.playCall}{' '}
        <em>
          {mockMatchData.shotProbability}% {t('match_broadcast.play_call.probability_label')}
        </em>
      </span>
      <span>
        <b>{t('match_broadcast.play_call.defense_label')}</b> {mockMatchData.defensiveScheme}
      </span>
    </section>
  );
}

function TimelineScrubber() {
  const { t } = useTranslation();
  return (
    <section className={styles.timeline}>
      <div className={styles.timelineLabels}>
        <b>{t('match_broadcast.timeline.label')}</b>
        <span>10:18 / 00:00</span>
      </div>
      <div className={styles.timelineTrack}>
        <span />
      </div>
      <div className={styles.timelineButtons}>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.previous')}>
          ◀
        </button>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.play')}>
          ▶
        </button>
        <button type="button" disabled aria-label={t('match_broadcast.timeline.next')}>
          ▶
        </button>
      </div>
    </section>
  );
}

function PlayByPlayColumn({ entries }: { entries: PlayByPlayLogEntry[] }) {
  const { t } = useTranslation();

  return (
    <BroadcastLogPanel title={t('match_broadcast.play_by_play.title')} entriesKey={entries.at(-1)?.id ?? ''}>
      {entries.map((entry) => (
        <div className={styles.logEntry} key={entry.id}>
          <span
            className={`${styles.eventTag} ${entry.type.includes('FOUL') ? styles.foul : entry.type.includes('MADE') ? styles.made : ''}`}
          >
            {entry.type}
          </span>
          <span className={styles.logClock}>{entry.gameClock}</span>
          <p>{entry.description}</p>
        </div>
      ))}
    </BroadcastLogPanel>
  );
}

function CommentaryColumn({ entries, isPaused }: { entries: CommentaryEntry[]; isPaused: boolean }) {
  const { t } = useTranslation();
  return (
    <BroadcastLogPanel
      title={t('match_broadcast.commentary.title')}
      entriesKey={entries.at(-1)?.id ?? ''}
      footer={<span className={styles.voice}>{isPaused ? ' · PAUSED' : ''}</span>}
    >
      {entries.map((entry) => (
        <article className={styles.commentaryEntry} key={entry.id}>
          <span className={styles.logClock}>{entry.gameClock}</span>
          <p>&ldquo;{entry.text}&rdquo;</p>
        </article>
      ))}
    </BroadcastLogPanel>
  );
}

function MomentumShiftEngine() {
  const { t } = useTranslation();
  const total = mockMatchData.momentum.homePoints + mockMatchData.momentum.awayPoints;
  const homeWidth = total === 0 ? 50 : (mockMatchData.momentum.homePoints / total) * 100;
  return (
    <Card>
      <div className={styles.panelHeading}>
        <h2>{t('match_broadcast.momentum.title')}</h2>
        <span className={styles.runDelta}>{mockMatchData.momentum.runDelta}</span>
      </div>
      <div className={styles.runLabel}>{mockMatchData.momentum.runLabel}</div>
      <div className={styles.momentumBar}>
        <span style={{ width: `${homeWidth}%` }} />
      </div>
      <div className={styles.momentumLegend}>
        <span>CHICAGO {mockMatchData.momentum.homePoints}</span>
        <span>BROOKLYN {mockMatchData.momentum.awayPoints}</span>
      </div>
      <div className={styles.momentumStats}>
        {mockMatchData.momentum.stats.map(([label, value]) => (
          <span key={label}>
            <b>{value}</b>
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}

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
        <CompactScoreboardBar
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
