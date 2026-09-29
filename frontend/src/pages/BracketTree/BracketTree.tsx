import { AppShell } from '../../components/AppShell';
import { useTranslation } from '../../lib/i18n/i18n';
import { CourtActionLog } from './components/CourtActionLog/CourtActionLog';
import { ChampionshipCard } from './components/ChampionshipCard/ChampionshipCard';
import { RoundColumn } from './components/RoundColumn/RoundColumn';
import { TeamStatsMatrix } from './components/TeamStatsMatrix/TeamStatsMatrix';
import { TournamentOverview } from './components/TournamentOverview/TournamentOverview';
import { TournamentStageBar } from './components/TournamentStageBar/TournamentStageBar';
import { mockBracketData, type BracketTeamKey } from './data/mockBracketData';
import styles from './BracketTree.module.css';

const FACT_ICONS: Record<string, string> = {
  format: '☷',
  regulation: '◴',
  shotClock: '◉',
  prizePool: '♜',
};

export default function BracketTree() {
  const { t } = useTranslation();
  const teamName = (key: BracketTeamKey) => t(`bracket_tree.teams.${key}`);
  const data = mockBracketData;

  const facts = data.overview.facts.map((fact) => ({
    id: fact.id,
    label: t(fact.labelKey),
    value: t(fact.valueKey),
    icon: FACT_ICONS[fact.id] ?? '',
  }));

  const rounds = data.rounds.map((round) => ({
    id: round.id,
    title: t(round.titleKey),
    summary: t(round.summaryKey),
    matches: round.matches.map((match) => ({
      id: match.id,
      matchNumber: match.number,
      venue: match.venue,
      status: match.status,
      statusLabel: t(match.statusKey),
      gameClock: 'gameClock' in match ? match.gameClock : undefined,
      shotClock: 'shotClock' in match ? match.shotClock : undefined,
      teams: match.teams.map((team) => ({
        name: teamName(team.teamKey),
        seed: team.seed,
        score: team.score,
        winner: team.winner,
      })),
      detail: t(match.detailKey),
      actionLabel: t(match.actionKey),
    })),
  }));

  const statRows = data.stats.rows.map((row) => ({
    id: row.teamKey,
    seed: row.seed,
    teamName: teamName(row.teamKey),
    values: [...row.values],
    status: t(row.statusKey),
  }));

  const actionEntries = data.actionLog.entries.map((entry) => ({
    id: entry.id,
    time: entry.time,
    team: teamName(entry.teamKey),
    player: entry.player,
    description: t(entry.descriptionKey),
  }));

  return (
    <AppShell activeNavItem="bracketTree" onlineCount={data.onlineTeams} sessionCode={data.sessionCode}>
      <main className={styles.page}>
        {/* <TournamentOverview
          sessionCode={data.sessionCode}
          statusLabel={t(data.overview.statusKey)}
          title={t(data.overview.titleKey)}
          description={t(data.overview.descriptionKey)}
          facts={facts}
        /> */}
        {/* <TournamentStageBar
          label={t(data.stage.labelKey)}
          currentStage={t(data.stage.currentStageKey)}
          syncStatus={t(data.stage.syncKey)}
        /> */}
        <section className={styles.bracketGrid} aria-label={t('bracket_tree.sections.bracket')}>
          {rounds.map((round) => (
            <RoundColumn key={round.id} {...round} />
          ))}
          <ChampionshipCard
            eyebrow={t(data.championship.eyebrowKey)}
            title={t(data.championship.titleKey)}
            description={t(data.championship.descriptionKey)}
            winnerSlots={data.championship.winnerSlots.map((key) => t(key))}
            seriesLabel={t(data.championship.seriesKey)}
            statusLabel={t(data.championship.statusKey)}
          />
        </section>
        <section className={styles.insightsGrid} aria-label={t('bracket_tree.sections.stats_and_log')}>
          <TeamStatsMatrix
            title={t(data.stats.titleKey)}
            meta={t(data.stats.metaKey)}
            columns={data.stats.columns.map((key) => t(key))}
            rows={statRows}
            footnote={t(data.stats.footnoteKey)}
          />
          <CourtActionLog
            title={t(data.actionLog.titleKey)}
            liveLabel={t(data.actionLog.liveKey)}
            entries={actionEntries}
            broadcaster={t(data.actionLog.broadcasterKey)}
            audioLabel={t(data.actionLog.audioKey)}
          />
        </section>
      </main>
    </AppShell>
  );
}
