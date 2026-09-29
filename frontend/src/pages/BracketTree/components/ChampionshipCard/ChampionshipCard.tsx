import { Card } from '../../../../components/Card';
import styles from './ChampionshipCard.module.css';

interface ChampionshipCardProps {
  eyebrow: string;
  title: string;
  description: string;
  winnerSlots: string[];
  seriesLabel: string;
  statusLabel: string;
}

export function ChampionshipCard({
  eyebrow,
  title,
  description,
  winnerSlots,
  seriesLabel,
  statusLabel,
}: ChampionshipCardProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.trophy} aria-hidden="true">
        🏆
      </div>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.slots}>
        {winnerSlots.map((slot) => (
          <div className={styles.slot} key={slot}>
            <span>{slot}</span>
            <strong>{statusLabel}</strong>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span>{seriesLabel}</span>
        <strong>{statusLabel}</strong>
      </div>
    </Card>
  );
}
