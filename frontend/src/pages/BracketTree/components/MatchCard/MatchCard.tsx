import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { NbaImage } from '../../../../components/NbaImage';
import { useTranslation } from '../../../../lib/i18n/i18n';
import {
  clearMatchPlaybackProgress,
  type MatchPlaybackContext,
  type MatchPlaybackProgress,
} from '../../../../lib/storage/matchPlaybackProgress';
import styles from './MatchCard.module.css';

interface MatchTeam {
  id: string;
  name: string;
  abbreviation?: string | null;
  nba_team_id?: number | null;
}

interface MatchCardProps {
  matchNumber: string;
  matchId: string | null;
  userTeamId: string | null;
  status: string | null;
  playbackContext: MatchPlaybackContext | null;
  playbackProgress: MatchPlaybackProgress | null;
  homeScore: number | null;
  awayScore: number | null;
  teams: readonly [MatchTeam | null, MatchTeam | null];
  tbdLabel: string;
}

export function MatchCard({
  matchNumber,
  matchId,
  userTeamId,
  status,
  playbackContext,
  playbackProgress,
  homeScore,
  awayScore,
  teams,
  tbdLabel,
}: MatchCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scores = matchId ? [homeScore ?? null, awayScore ?? null] : [null, null];
  const hasBothTeams = Boolean(teams[0] && teams[1]);
  const canPlay = Boolean(matchId && hasBothTeams && (status === 'ready' || status === 'finished'));
  const action =
    playbackProgress && !playbackProgress.isComplete
      ? 'resume'
      : status === 'finished' || playbackProgress?.isComplete
        ? 'replay'
        : status === 'ready'
          ? 'watch'
          : null;
  const inner = (
    <>
      <span className={styles.matchNumber}>{matchNumber}</span>
      <div className={styles.teams}>
        {teams.map((team, index) => {
          const isUserTeam = Boolean(team && team.id === userTeamId);
          const score = scores[index];
          return (
            <div key={team?.id ?? index} className={styles.team}>
              {team ? (
                <span className={styles.teamMain}>
                  <NbaImage
                    kind="team"
                    nbaId={team.nba_team_id}
                    alt={`${team.name} logo`}
                    fallback={team.abbreviation ?? team.name}
                    className={styles.teamLogo}
                  />
                  <span className={isUserTeam ? styles.teamNameHighlight : styles.teamName}>
                    {isUserTeam ? `${team.name} ★` : team.name}
                  </span>
                </span>
              ) : (
                <span className={styles.emptyTeam}>{tbdLabel}</span>
              )}
              {score != null ? <span className={styles.score}>{score}</span> : null}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <Card className={styles.card}>
      {inner}
      {canPlay && matchId && action ? (
        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            if (action === 'replay') {
              if (playbackContext) clearMatchPlaybackProgress(playbackContext);
            }
            navigate(`/matches/${matchId}`);
          }}
        >
          {t(`bracket_tree.actions.${action}`)}
        </Button>
      ) : null}
    </Card>
  );
}
