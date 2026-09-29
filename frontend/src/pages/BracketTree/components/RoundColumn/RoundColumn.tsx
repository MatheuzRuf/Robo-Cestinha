import { MatchCard, type MatchTeam } from '../MatchCard/MatchCard';
import styles from './RoundColumn.module.css';

export interface RoundMatch {
  id: string;
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

interface RoundColumnProps {
  title: string;
  summary: string;
  matches: RoundMatch[];
}

export function RoundColumn({ title, summary, matches }: RoundColumnProps) {
  return (
    <section className={styles.column}>
      <header className={styles.heading}>
        <h2>{title}</h2>
        <span>{summary}</span>
      </header>
      <div className={styles.matches}>
        {matches.map((match) => (
          <MatchCard key={match.id} {...match} />
        ))}
      </div>
    </section>
  );
}
