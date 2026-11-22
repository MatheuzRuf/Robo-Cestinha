import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { NbaImage } from '../../components/NbaImage';
import { useTranslation } from '../../lib/i18n/i18n';
import { simulationService } from '../../services/simulationService';
import { useSessionStore } from '../../stores/sessionStore';
import type { SimulationFrame, SimulationPlayer, SimulationResponse, SimulationTeam } from '../../types/matchBroadcast';
import {
  buildLeadMarginSummary,
  buildPassingNetwork,
  buildPlayerHeatmap,
  buildScorePath,
  deriveMatchStats,
  type PlayerMatchStats,
} from './stats';
import styles from './MatchStats.module.css';

type Translate = (key: string, values?: Record<string, string | number>) => string;

function percentage(made: number, attempted: number, locale: string) {
  if (!attempted) return '—';
  return `${((made / attempted) * 100).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

function fieldGoalLine(made: number, attempted: number, locale: string) {
  return `${made}/${attempted} · ${percentage(made, attempted, locale)}`;
}

function PlayerRoster({
  players,
  homeTeam,
  awayTeam,
  selectedPlayerId,
  onSelect,
  t,
}: {
  players: PlayerMatchStats[];
  homeTeam: SimulationTeam;
  awayTeam: SimulationTeam;
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
  t: Translate;
}) {
  const rosterPlayers = [...players].sort(
    (left, right) =>
      Number(left.player.side !== 'home') - Number(right.player.side !== 'home') ||
      left.player.name.localeCompare(right.player.name),
  );
  const rosterGroups = [
    { side: 'home' as const, team: homeTeam, players: rosterPlayers.filter((row) => row.player.side === 'home') },
    { side: 'away' as const, team: awayTeam, players: rosterPlayers.filter((row) => row.player.side === 'away') },
  ];

  return (
    <Card className={styles.playersPanel}>
      <div className={styles.playersHeading}>
        <div>
          <h2>{t('match_stats.lineups')}</h2>
          <p>{t('match_stats.lineups_note')}</p>
        </div>
      </div>
      <div className={styles.teamRosterGrid}>
        {rosterGroups.map(({ side, team, players: teamPlayers }) => (
          <section
            key={team.teamId}
            className={`${styles.teamRoster} ${side === 'home' ? styles.homeRoster : styles.awayRoster}`}
          >
            <header className={styles.teamRosterHeading}>
              <NbaImage
                kind="team"
                nbaId={team.nbaTeamId}
                alt={`${team.name} logo`}
                fallback={team.abbreviation}
                className={styles.rosterTeamLogo}
              />
              <div>
                <h3>{team.name}</h3>
                <span>{t('match_stats.roster_count', { count: teamPlayers.length })}</span>
              </div>
            </header>
            <div className={styles.playerGrid}>
              {teamPlayers.map((row) => (
                <button
                  key={row.player.playerId}
                  className={`${styles.playerCard} ${
                    selectedPlayerId === row.player.playerId ? styles.selectedPlayer : ''
                  }`}
                  type="button"
                  title={row.player.name}
                  aria-pressed={selectedPlayerId === row.player.playerId}
                  onClick={() => onSelect(row.player.playerId)}
                >
                  <NbaImage
                    kind="player"
                    nbaId={row.player.nbaPlayerId}
                    alt=""
                    fallback={row.player.name}
                    size="profile"
                    className={styles.rosterPlayerImage}
                  />
                  <span className={styles.playerCardShade} />
                  <span className={styles.playerCardCopy}>
                    <strong>{row.player.name}</strong>
                    <span>{row.player.position}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function CourtHeatmap({
  frames,
  player,
  description,
  large = false,
}: {
  frames: SimulationFrame[];
  player: SimulationPlayer;
  description: string;
  large?: boolean;
}) {
  const cells = useMemo(() => buildPlayerHeatmap(frames, player.playerId), [frames, player.playerId]);

  return (
    <svg
      className={`${styles.court} ${large ? styles.largeCourt : ''}`}
      viewBox="0 0 940 500"
      role="img"
      aria-labelledby="court-title court-description"
    >
      <title id="court-title">{player.name}</title>
      <desc id="court-description">{description}</desc>
      <rect className={styles.courtSurface} x="8" y="8" width="924" height="484" rx="10" />
      <line className={styles.courtLine} x1="470" y1="8" x2="470" y2="492" />
      <circle className={styles.courtLine} cx="470" cy="250" r="70" />
      <rect className={styles.courtLine} x="8" y="145" width="160" height="210" />
      <rect className={styles.courtLine} x="772" y="145" width="160" height="210" />
      <circle className={styles.courtLine} cx="168" cy="250" r="22" />
      <circle className={styles.courtLine} cx="772" cy="250" r="22" />
      <path className={styles.courtLine} d="M 168 95 A 155 155 0 0 1 168 405" />
      <path className={styles.courtLine} d="M 772 95 A 155 155 0 0 0 772 405" />
      {cells.map((cell) => (
        <circle
          key={`${cell.x}-${cell.y}`}
          className={styles.heatCell}
          cx={cell.x}
          cy={cell.y}
          r="36"
          opacity={0.12 + cell.intensity * 0.64}
        />
      ))}
    </svg>
  );
}

function ScoreProgression({ simulation, t }: { simulation: SimulationResponse; t: (key: string) => string }) {
  const homePath = useMemo(() => buildScorePath(simulation.frames, 'home'), [simulation.frames]);
  const awayPath = useMemo(() => buildScorePath(simulation.frames, 'away'), [simulation.frames]);

  return (
    <Card className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{t('match_stats.score_progression')}</h2>
          <p>{t('match_stats.score_progression_note')}</p>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.homeLegend}>{simulation.teams.home.abbreviation}</span>
          <span className={styles.awayLegend}>{simulation.teams.away.abbreviation}</span>
        </div>
      </div>
      <svg
        className={styles.scoreChart}
        viewBox="0 0 760 180"
        role="img"
        aria-label={t('match_stats.score_progression')}
      >
        <line className={styles.chartGridline} x1="0" y1="45" x2="760" y2="45" />
        <line className={styles.chartGridline} x1="0" y1="90" x2="760" y2="90" />
        <line className={styles.chartGridline} x1="0" y1="135" x2="760" y2="135" />
        {homePath ? <polyline className={styles.homeScoreLine} points={homePath} /> : null}
        {awayPath ? <polyline className={styles.awayScoreLine} points={awayPath} /> : null}
      </svg>
      <div className={styles.chartAxis}>
        <span>{t('match_stats.first_step')}</span>
        <span>{t('match_stats.last_step')}</span>
      </div>
    </Card>
  );
}

function LeadMarginChart({ simulation, t }: { simulation: SimulationResponse; t: Translate }) {
  const summary = useMemo(() => buildLeadMarginSummary(simulation.frames), [simulation.frames]);
  const frameCount = Math.max(1, simulation.frames.length - 1);

  return (
    <Card className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{t('match_stats.lead_margin')}</h2>
          <p>{t('match_stats.lead_margin_note')}</p>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.homeLegend}>{simulation.teams.home.abbreviation}</span>
          <span className={styles.awayLegend}>{simulation.teams.away.abbreviation}</span>
        </div>
      </div>
      <svg className={styles.marginChart} viewBox="0 0 760 205" role="img" aria-label={t('match_stats.lead_margin')}>
        <line className={styles.marginBaseline} x1="0" y1="76" x2="760" y2="76" />
        {summary.segments.map((segment, index) => (
          <polyline
            key={`${segment.side}-${index}`}
            className={
              segment.side === 'home'
                ? styles.homeMarginLine
                : segment.side === 'away'
                  ? styles.awayMarginLine
                  : styles.tiedMarginLine
            }
            points={segment.points}
          />
        ))}
        {summary.scoringRuns.map((run, index) => {
          const start = 64 + (run.startFrame / frameCount) * 680;
          const end = 64 + (run.endFrame / frameCount) * 680;
          const team = run.side === 'home' ? simulation.teams.home : simulation.teams.away;
          return (
            <rect
              key={`${run.side}-${run.startFrame}-${index}`}
              className={run.side === 'home' ? styles.homeRunBar : styles.awayRunBar}
              x={start}
              y={run.side === 'home' ? 155 : 178}
              width={Math.max(4, end - start)}
              height="9"
              rx="4"
            >
              <title>{t('match_stats.scoring_run_title', { team: team.abbreviation, points: run.points })}</title>
            </rect>
          );
        })}
      </svg>
      <div className={styles.chartAxis}>
        <span>{t('match_stats.first_step')}</span>
        <span>{t('match_stats.last_step')}</span>
      </div>
      <div className={styles.marginHighlights}>
        <div>
          <strong>{summary.leadChanges}</strong>
          <span>{t('match_stats.lead_changes')}</span>
        </div>
        <div>
          <strong>{summary.largestHomeLead}</strong>
          <span>{t('match_stats.largest_lead', { team: simulation.teams.home.abbreviation })}</span>
        </div>
        <div>
          <strong>{summary.largestAwayLead}</strong>
          <span>{t('match_stats.largest_lead', { team: simulation.teams.away.abbreviation })}</span>
        </div>
        <div>
          <strong>{summary.scoringRuns.length}</strong>
          <span>{t('match_stats.scoring_runs')}</span>
        </div>
      </div>
    </Card>
  );
}

function PassingNetworkChart({
  simulation,
  players,
  t,
}: {
  simulation: SimulationResponse;
  players: SimulationPlayer[];
  t: Translate;
}) {
  const network = useMemo(() => buildPassingNetwork(simulation, players), [players, simulation]);
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    for (const side of ['home', 'away'] as const) {
      const teamPlayers = network.players
        .filter((player) => player.side === side)
        .sort((left, right) => left.name.localeCompare(right.name));
      const centerX = side === 'home' ? 245 : 755;
      teamPlayers.forEach((player, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(1, teamPlayers.length)) * Math.PI * 2;
        result.set(player.playerId, {
          x: centerX + Math.cos(angle) * 132,
          y: 210 + Math.sin(angle) * 122,
        });
      });
    }
    return result;
  }, [network.players]);
  const maxPassCount = Math.max(1, ...network.links.map((link) => link.count));

  return (
    <Card className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{t('match_stats.passing_network')}</h2>
          <p>{t('match_stats.passing_network_note')}</p>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.homeLegend}>{simulation.teams.home.abbreviation}</span>
          <span className={styles.awayLegend}>{simulation.teams.away.abbreviation}</span>
        </div>
      </div>
      {network.links.length ? (
        <svg
          className={styles.passingNetwork}
          viewBox="0 0 1000 420"
          role="img"
          aria-label={t('match_stats.passing_network')}
        >
          <line className={styles.networkDivider} x1="500" y1="25" x2="500" y2="395" />
          {network.links.map((link) => {
            const from = positions.get(link.fromPlayerId);
            const to = positions.get(link.toPlayerId);
            if (!from || !to) return null;
            const strength = link.count / maxPassCount;
            const className =
              strength >= 0.7 ? styles.strongPassLink : strength >= 0.4 ? styles.mediumPassLink : styles.passLink;
            const middleX = (from.x + to.x) / 2;
            const middleY = (from.y + to.y) / 2 - (from.y < to.y ? 20 : -20);
            const passer = network.players.find((player) => player.playerId === link.fromPlayerId);
            const receiver = network.players.find((player) => player.playerId === link.toPlayerId);
            return (
              <path
                key={`${link.fromPlayerId}-${link.toPlayerId}`}
                className={`${className} ${link.teamId === simulation.teams.home.teamId ? styles.homePassLink : styles.awayPassLink}`}
                d={`M ${from.x} ${from.y} Q ${middleX} ${middleY} ${to.x} ${to.y}`}
              >
                <title>
                  {t('match_stats.pass_connection_title', {
                    passer: passer?.name ?? '',
                    receiver: receiver?.name ?? '',
                    count: link.count,
                  })}
                </title>
              </path>
            );
          })}
          {network.players.map((player) => {
            const position = positions.get(player.playerId);
            if (!position) return null;
            return (
              <g key={player.playerId}>
                <circle
                  className={player.side === 'home' ? styles.homeNetworkNode : styles.awayNetworkNode}
                  cx={position.x}
                  cy={position.y}
                  r="15"
                />
                <text className={styles.networkPlayerLabel} x={position.x} y={position.y + 31} textAnchor="middle">
                  {player.name}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <p className={styles.emptyNetwork}>{t('match_stats.no_pass_connections')}</p>
      )}
    </Card>
  );
}

export default function MatchStats() {
  const { matchId = '' } = useParams();
  const { t, locale } = useTranslation();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const query = useQuery({
    queryKey: ['match-stats', activeSession?.sessionHash, activeSession?.userId, matchId],
    queryFn: ({ signal }) => {
      if (!activeSession) throw new Error('No active session');
      return simulationService.getSimulation({
        matchId,
        sessionHash: activeSession.sessionHash,
        signal,
      });
    },
    enabled: Boolean(activeSession && matchId),
    retry: false,
  });
  const simulation = query.data;
  const stats = useMemo(() => (simulation ? deriveMatchStats(simulation) : null), [simulation]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'heatmaps'>('overview');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const selectedPlayerStats =
    stats?.players.find((row) => row.player.playerId === selectedPlayerId) ?? stats?.players[0] ?? null;
  const homeTeam = simulation?.teams.home;
  const awayTeam = simulation?.teams.away;
  const homeStats = homeTeam && stats ? stats.teams[homeTeam.teamId] : null;
  const awayStats = awayTeam && stats ? stats.teams[awayTeam.teamId] : null;

  if (!activeSession) {
    return (
      <main className={styles.page}>
        <Card className={styles.messageCard}>
          <p>{t('match_stats.no_session')}</p>
        </Card>
      </main>
    );
  }

  if (query.isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.statusMessage} role="status">
          {t('match_stats.loading')}
        </p>
      </main>
    );
  }

  if (query.isError || !simulation || !stats || !homeTeam || !awayTeam || !homeStats || !awayStats) {
    return (
      <main className={styles.page}>
        <Card className={styles.messageCard}>
          <p role="alert">{t('match_stats.load_error')}</p>
        </Card>
      </main>
    );
  }

  const comparisonRows = [
    {
      label: t('match_stats.points'),
      home: String(homeStats.points),
      away: String(awayStats.points),
    },
    {
      label: t('match_stats.field_goals'),
      home: fieldGoalLine(homeStats.fieldGoalsMade, homeStats.fieldGoalsAttempted, locale),
      away: fieldGoalLine(awayStats.fieldGoalsMade, awayStats.fieldGoalsAttempted, locale),
    },
    {
      label: t('match_stats.three_pointers'),
      home: fieldGoalLine(homeStats.threePointersMade, homeStats.threePointersAttempted, locale),
      away: fieldGoalLine(awayStats.threePointersMade, awayStats.threePointersAttempted, locale),
    },
    {
      label: t('match_stats.passes_completed'),
      home: String(homeStats.passesCompleted),
      away: String(awayStats.passesCompleted),
    },
    {
      label: t('match_stats.turnovers'),
      home: String(homeStats.turnovers),
      away: String(awayStats.turnovers),
    },
    {
      label: t('match_stats.fouls'),
      home: String(homeStats.fouls),
      away: String(awayStats.fouls),
    },
    {
      label: t('match_stats.team_rebound_events'),
      home: String(homeStats.rebounds),
      away: String(awayStats.rebounds),
    },
    {
      label: t('match_stats.possession_steps'),
      home: `${homeStats.possessionShare.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
      away: `${awayStats.possessionShare.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
    },
  ];

  const selectedPlayer = selectedPlayerStats?.player;
  const selectedPlayerTeam = selectedPlayer ? (selectedPlayer.teamId === homeTeam.teamId ? homeTeam : awayTeam) : null;

  return (
    <main className={styles.page}>
      <div className={styles.statsTabs} role="tablist" aria-label={t('match_stats.label')}>
        {[
          { value: 'overview' as const, label: t('match_stats.tab_overview') },
          { value: 'players' as const, label: t('match_stats.tab_players') },
          { value: 'heatmaps' as const, label: t('match_stats.tab_heatmaps') },
        ].map((tab, index, tabs) => (
          <button
            key={tab.value}
            id={`match-stats-tab-${tab.value}`}
            className={styles.statsTab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            aria-controls={`match-stats-panel-${tab.value}`}
            tabIndex={activeTab === tab.value ? 0 : -1}
            onClick={() => setActiveTab(tab.value)}
            onKeyDown={(event) => {
              let nextIndex = index;
              if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = tabs.length - 1;
              else return;

              event.preventDefault();
              const nextTab = tabs[nextIndex];
              if (!nextTab) return;
              setActiveTab(nextTab.value);
              window.requestAnimationFrame(() => document.getElementById(`match-stats-tab-${nextTab.value}`)?.focus());
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        id="match-stats-panel-overview"
        className={styles.tabPanel}
        role="tabpanel"
        aria-labelledby="match-stats-tab-overview"
        tabIndex={activeTab === 'overview' ? 0 : -1}
        hidden={activeTab !== 'overview'}
      >
        {activeTab === 'overview' ? (
          <div className={styles.dashboardGrid}>
            <Card className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>{t('match_stats.team_comparison')}</h2>
                  <p>{t('match_stats.team_comparison_note')}</p>
                </div>
              </div>
              <div className={styles.comparisonTableWrap}>
                <table className={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th scope="col">{homeTeam.abbreviation}</th>
                      <th scope="col">{t('match_stats.stat')}</th>
                      <th scope="col">{awayTeam.abbreviation}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.home}</td>
                        <th scope="row">{row.label}</th>
                        <td>{row.away}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <ScoreProgression simulation={simulation} t={t} />
            <LeadMarginChart simulation={simulation} t={t} />
            <PassingNetworkChart simulation={simulation} players={stats.players.map((row) => row.player)} t={t} />
          </div>
        ) : null}
        {activeTab === 'overview' ? <p className={styles.dataNote}>{t('match_stats.data_note')}</p> : null}
      </section>

      <section
        id="match-stats-panel-players"
        className={styles.tabPanel}
        role="tabpanel"
        aria-labelledby="match-stats-tab-players"
        tabIndex={activeTab === 'players' ? 0 : -1}
        hidden={activeTab !== 'players'}
      >
        {activeTab === 'players' ? (
          <div className={styles.playerTableWrap}>
            <table className={styles.playerTable}>
              <thead>
                <tr>
                  <th scope="col">{t('match_stats.player')}</th>
                  <th scope="col">{t('match_stats.team')}</th>
                  <th scope="col">{t('match_stats.points')}</th>
                  <th scope="col">{t('match_stats.field_goals')}</th>
                  <th scope="col">{t('match_stats.three_pointers')}</th>
                  <th scope="col">{t('match_stats.passes_completed')}</th>
                  <th scope="col">{t('match_stats.turnovers')}</th>
                  <th scope="col">{t('match_stats.fouls')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.players.map((row) => (
                  <tr key={row.player.playerId}>
                    <td data-label={t('match_stats.player')}>{row.player.name}</td>
                    <td data-label={t('match_stats.team')}>
                      {row.player.side === 'home' ? homeTeam.abbreviation : awayTeam.abbreviation}
                    </td>
                    <td data-label={t('match_stats.points')}>{row.points}</td>
                    <td data-label={t('match_stats.field_goals')}>
                      {fieldGoalLine(row.fieldGoalsMade, row.fieldGoalsAttempted, locale)}
                    </td>
                    <td data-label={t('match_stats.three_pointers')}>
                      {fieldGoalLine(row.threePointersMade, row.threePointersAttempted, locale)}
                    </td>
                    <td data-label={t('match_stats.passes_completed')}>{row.passesCompleted}</td>
                    <td data-label={t('match_stats.turnovers')}>{row.turnovers}</td>
                    <td data-label={t('match_stats.fouls')}>{row.fouls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section
        id="match-stats-panel-heatmaps"
        className={styles.tabPanel}
        role="tabpanel"
        aria-labelledby="match-stats-tab-heatmaps"
        tabIndex={activeTab === 'heatmaps' ? 0 : -1}
        hidden={activeTab !== 'heatmaps'}
      >
        {activeTab === 'heatmaps' ? (
          showHeatmap && selectedPlayerStats && selectedPlayer && selectedPlayerTeam ? (
            <Card className={styles.heatmapContainer}>
              <div className={styles.heatmapLayout}>
                <aside
                  className={`${styles.playerDetails} ${
                    selectedPlayer.side === 'home' ? styles.homePlayerDetails : styles.awayPlayerDetails
                  }`}
                >
                  <Button variant="outline" onClick={() => setShowHeatmap(false)}>
                    {t('match_stats.back_to_lineups')}
                  </Button>
                  <NbaImage
                    kind="player"
                    nbaId={selectedPlayer.nbaPlayerId}
                    alt={selectedPlayer.name}
                    fallback={selectedPlayer.name}
                    size="profile"
                    className={styles.detailPortrait}
                  />
                  <div className={styles.detailPlayerName}>
                    <h2>{selectedPlayer.name}</h2>
                    <span>{selectedPlayer.position}</span>
                  </div>
                  <div className={styles.detailTeam}>
                    <NbaImage
                      kind="team"
                      nbaId={selectedPlayerTeam.nbaTeamId}
                      alt={`${selectedPlayerTeam.name} logo`}
                      fallback={selectedPlayerTeam.abbreviation}
                      className={styles.detailTeamLogo}
                    />
                    <span>{selectedPlayerTeam.name}</span>
                  </div>
                  <div className={styles.detailStats}>
                    <div>
                      <strong>{selectedPlayerStats.points}</strong>
                      <span>{t('match_stats.points')}</span>
                    </div>
                    <div>
                      <strong>
                        {fieldGoalLine(
                          selectedPlayerStats.fieldGoalsMade,
                          selectedPlayerStats.fieldGoalsAttempted,
                          locale,
                        )}
                      </strong>
                      <span>{t('match_stats.field_goals')}</span>
                    </div>
                    <div>
                      <strong>{selectedPlayerStats.passesCompleted}</strong>
                      <span>{t('match_stats.passes_completed')}</span>
                    </div>
                    <div>
                      <strong>{selectedPlayerStats.turnovers}</strong>
                      <span>{t('match_stats.turnovers')}</span>
                    </div>
                  </div>
                </aside>
                <section className={styles.heatmapVisualization}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>{t('match_stats.player_activity')}</h2>
                      <p>{t('match_stats.heatmap_note')}</p>
                    </div>
                  </div>
                  <CourtHeatmap
                    frames={simulation.frames}
                    player={selectedPlayer}
                    description={t('match_stats.heatmap_description')}
                    large
                  />
                </section>
              </div>
            </Card>
          ) : (
            <PlayerRoster
              players={stats.players}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              selectedPlayerId={selectedPlayerStats?.player.playerId ?? null}
              onSelect={(playerId) => {
                setSelectedPlayerId(playerId);
                setShowHeatmap(true);
              }}
              t={t}
            />
          )
        ) : null}
      </section>
    </main>
  );
}
