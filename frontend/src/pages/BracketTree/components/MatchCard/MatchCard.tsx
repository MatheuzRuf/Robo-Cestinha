import { Link } from 'react-router-dom';
import { Card } from '../../../../components/Card';
import styles from './MatchCard.module.css';

interface MatchTeam {
  id: string;
  name: string;
}

interface MatchCardProps {
  matchNumber: string;
  matchId: string | null;
  userTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  teams: readonly [MatchTeam | null, MatchTeam | null];
  tbdLabel: string;
}

export function MatchCard({
  matchNumber,
  matchId,
  userTeamId,
  homeScore,
  awayScore,
  teams,
  tbdLabel,
}: MatchCardProps) {
  const scores = matchId ? [homeScore ?? null, awayScore ?? null] : [null, null];
  const isClickable = Boolean(matchId);
  const inner = (
    <>
      <span className={styles.matchNumber}>{matchNumber}</span>
      <div className={styles.teams}>
        {teams.map((team, index) => {
          const isUserTeam = Boolean(team && team.id === userTeamId);
          const score = scores[index];
          return (
            <div key={team?.id ?? index} className={styles.team}>
              <span className={team?.name ? (isUserTeam ? styles.teamNameHighlight : styles.teamName) : styles.emptyTeam}>
                {isUserTeam ? `${team?.name} ★` : (team?.name ?? tbdLabel)}
              </span>
              {score != null ? <span className={styles.score}>{score}</span> : null}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <Card className={`${styles.card} ${isClickable ? styles.clickable : ''}`}>
      {matchId ? (
        <Link to={`/matches/${matchId}`} className={styles.link} aria-label={matchNumber}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Card>
  );
}