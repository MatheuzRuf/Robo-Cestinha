import { Card } from '../../../../components/Card';
import { StatusBadge } from '../../../../components/StatusBadge';
import styles from './MatchCard.module.css';

export interface MatchTeam {
  name: string;
  seed: number;
  score: number | null;
  winner: boolean;
}

interface MatchCardProps {
  matchNumber: string;
  venue: string;
  status: 'complete' | 'live' | 'upcoming';
  statusLabel: string;
  gameClock?: string;
  shotClock?: string;
  teams: MatchTeam[];
  detail: string;
  actionLabel?: string;
}

export function MatchCard({
  matchNumber,
  venue,
  status,
  statusLabel,
  gameClock,
  shotClock,
  teams,
  detail,
  actionLabel,
}: MatchCardProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.matchMeta}>
        <div className={styles.statusGroup}>
          <StatusBadge tone={status === 'complete' ? 'complete' : status === 'live' ? 'live' : 'info'}>
            {statusLabel}
          </StatusBadge>
          {gameClock ? <span className={styles.gameClock}>{gameClock}</span> : null}
        </div>
        <span className={styles.venue}>
          {matchNumber} · {venue}
        </span>
      </div>
      <div className={styles.teams}>
        {teams.map((team) => (
          <div className={`${styles.team} ${team.winner ? styles.winner : ''}`} key={`${team.seed}-${team.name}`}>
            <span className={styles.seed}>#{team.seed}</span>
            <span className={styles.teamName}>{team.name}</span>
            <strong className={styles.score}>{team.score ?? '—'}</strong>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span className={styles.detail}>{detail}</span>
        {shotClock ? <span className={styles.shotClock}>{shotClock}</span> : null}
        {actionLabel ? <span className={styles.action}>{actionLabel}</span> : null}
      </div>
    </Card>
  );
}
