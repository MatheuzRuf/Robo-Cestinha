import { Card } from '../../../../components/Card';
import { StatusBadge } from '../../../../components/StatusBadge';
import styles from './TournamentOverview.module.css';

export interface TournamentFact {
  id: string;
  label: string;
  value: string;
  icon: string;
}

interface TournamentOverviewProps {
  sessionCode: string;
  statusLabel: string;
  title: string;
  description: string;
  facts: TournamentFact[];
}

export function TournamentOverview({ sessionCode, statusLabel, title, description, facts }: TournamentOverviewProps) {
  return (
    <section className={styles.overview}>
      <div className={styles.heading}>
        <div className={styles.identity}>
          <div className={styles.eyebrowRow}>
            <span className={styles.sessionCode}>{sessionCode}</span>
            <StatusBadge tone="live">{statusLabel}</StatusBadge>
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className={styles.facts}>
        {facts.map((fact) => (
          <Card key={fact.id} className={styles.fact}>
            <span className={styles.factIcon} aria-hidden="true">
              {fact.icon}
            </span>
            <div>
              <span className={styles.factLabel}>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
