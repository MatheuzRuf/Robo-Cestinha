import { Card } from '../../../../components/Card';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { MomentumSnapshot } from '../../../../types/matchBroadcast';
import styles from '../../MatchBroadcast.module.css';

interface MomentumShiftEngineProps {
  momentum: MomentumSnapshot;
  homeName: string;
  awayName: string;
}

export function MomentumShiftEngine({ momentum, homeName, awayName }: MomentumShiftEngineProps) {
  const { t } = useTranslation();
  const total = momentum.homePoints + momentum.awayPoints;
  const homeWidth = total === 0 ? 50 : (momentum.homePoints / total) * 100;

  return (
    <Card>
      <div className={styles.panelHeading}>
        <h2>{t('match_broadcast.momentum.title')}</h2>
        <span className={styles.runDelta}>{momentum.runDelta}</span>
      </div>
      <div className={styles.runLabel}>{momentum.runLabel}</div>
      <div className={styles.momentumBar}>
        <span style={{ width: `${homeWidth}%` }} />
      </div>
      <div className={styles.momentumLegend}>
        <span>
          {homeName} {momentum.homePoints}
        </span>
        <span>
          {awayName} {momentum.awayPoints}
        </span>
      </div>
      <div className={styles.momentumStats}>
        {momentum.stats.map(([label, value]) => (
          <span key={label}>
            <b>{value}</b>
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}
