import { MatchCard } from '../MatchCard/MatchCard';
import styles from './RoundColumn.module.css';

export interface RoundMatch {
  matchNumber: string;
  teams: readonly [{ id: string; name: string } | null, { id: string; name: string } | null];
}

interface RoundColumnProps {
  title: string;
  matches: RoundMatch[];
  tbdLabel: string;
}

export function RoundColumn({ title, matches, tbdLabel }: RoundColumnProps) {
  return (
    <section className={styles.column}>
      <header className={styles.heading}>
        <h2>{title}</h2>
      </header>
      <div className={styles.matches}>
        {matches.map((match) => (
          <MatchCard key={match.matchNumber} {...match} tbdLabel={tbdLabel} />
        ))}
      </div>
    </section>
  );
}
