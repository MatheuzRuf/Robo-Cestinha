import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { StatusBadge } from '../../../components/StatusBadge';
import styles from './SessionCard.module.css';

interface SessionCardProps {
  sessionCode: string;
  sessionName: string;
  isActive: boolean;
  activeLabel: string;
  currentLabel: string;
  savedLabel: string;
  joinedAsLabel: string;
  lastVisitedLabel: string;
  resumeLabel: string;
  onResume: () => void;
}

export function SessionCard({
  sessionCode,
  sessionName,
  isActive,
  activeLabel,
  currentLabel,
  savedLabel,
  joinedAsLabel,
  lastVisitedLabel,
  resumeLabel,
  onResume,
}: SessionCardProps) {
  return (
    <Card>
      <div className={styles.root}>
        <div className={styles.topRow}>
          <StatusBadge tone={isActive ? 'info' : 'paused'}>{isActive ? activeLabel : savedLabel}</StatusBadge>
          <span className={styles.sessionCode}>{sessionCode}</span>
        </div>
        <div className={styles.sessionName}>{sessionName}</div>
        <div className={styles.detailLine}>{joinedAsLabel}</div>
        <div className={styles.footerRow}>{lastVisitedLabel}</div>
        <Button variant={isActive ? 'secondary' : 'primary'} onClick={onResume} disabled={isActive} fullWidth>
          {isActive ? currentLabel : resumeLabel}
        </Button>
      </div>
    </Card>
  );
}
