import { Card } from '../../../../components/Card';
import styles from './MatchCard.module.css';

interface MatchTeam {
  id: string;
  name: string;
}

interface MatchCardProps {
  matchNumber: string;
  teams: readonly [MatchTeam | null, MatchTeam | null];
  tbdLabel: string;
}

export function MatchCard({ matchNumber, teams, tbdLabel }: MatchCardProps) {
  return (
    <Card className={styles.card}>
      <span className={styles.matchNumber}>{matchNumber}</span>
      <div className={styles.teams}>
        {teams.map((team, index) => (
          <div className={styles.team} key={team?.id ?? index}>
            <span className={team ? styles.teamName : styles.emptyTeam}>{team?.name ?? tbdLabel}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
