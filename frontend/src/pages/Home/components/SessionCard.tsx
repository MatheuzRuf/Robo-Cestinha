import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { StatusBadge } from '../../../components/StatusBadge';
import styles from './SessionCard.module.css';

interface SessionCardProps {
  sessionCode: string;
  sessionName: string;
  status: { tone: 'live' | 'complete' | 'paused'; label: string };
  detailLine: string;
  primaryStat: { label: string; value: string };
  secondaryStat?: { label: string; value: string; highlight?: boolean };
  footerLeft: string;
  footerRight: string;
  cta: { label: string; variant: 'primary' | 'secondary' | 'outline'; onClick: () => void };
}

export function SessionCard({ sessionCode, sessionName, status, detailLine, primaryStat, secondaryStat, footerLeft, footerRight, cta }: SessionCardProps) {
  return (
    <Card>
      <div className={styles.root}>
        <div className={styles.topRow}>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className={styles.sessionCode}>{sessionCode}</span>
        </div>
        <div className={styles.sessionName}>{sessionName}</div>
        <div className={styles.detailLine}>{detailLine}</div>
        <div className={styles.statRow}>
          <div>
            <div className={styles.statLabel}>{primaryStat.label}</div>
            <div className={styles.statValue}>{primaryStat.value}</div>
          </div>
          {secondaryStat ? <div className={`${styles.secondaryStat} ${secondaryStat.highlight ? styles.highlight : ''}`.trim()}>{secondaryStat.value}</div> : null}
        </div>
        <div className={styles.footerRow}>
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
        <Button variant={cta.variant} onClick={cta.onClick} fullWidth>
          {cta.label}
        </Button>
      </div>
    </Card>
  );
}
