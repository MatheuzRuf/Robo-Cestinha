import { StatusBadge } from '../../../../components/StatusBadge';
import styles from './TournamentStageBar.module.css';

interface TournamentStageBarProps {
  label: string;
  currentStage: string;
  syncStatus: string;
}

export function TournamentStageBar({ label, currentStage, syncStatus }: TournamentStageBarProps) {
  return (
    <section className={styles.bar} aria-label={label}>
      <span className={styles.label}>{label}</span>
      <strong>{currentStage}</strong>
      <StatusBadge tone="info">{syncStatus}</StatusBadge>
    </section>
  );
}
