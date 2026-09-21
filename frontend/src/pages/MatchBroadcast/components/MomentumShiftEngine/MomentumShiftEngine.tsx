import { Card } from '../../../../components/Card';
import { useTranslation } from '../../../../lib/i18n/i18n';
import { mockMatchData } from '../../data/mockMatchData';
import styles from '../../MatchBroadcast.module.css';

export function MomentumShiftEngine() {
  const { t } = useTranslation();
  const total = mockMatchData.momentum.homePoints + mockMatchData.momentum.awayPoints;
  const homeWidth = total === 0 ? 50 : (mockMatchData.momentum.homePoints / total) * 100;

  return (
    <Card>
      <div className={styles.panelHeading}>
        <h2>{t('match_broadcast.momentum.title')}</h2>
        <span className={styles.runDelta}>{mockMatchData.momentum.runDelta}</span>
      </div>
      <div className={styles.runLabel}>{mockMatchData.momentum.runLabel}</div>
      <div className={styles.momentumBar}>
        <span style={{ width: `${homeWidth}%` }} />
      </div>
      <div className={styles.momentumLegend}>
        <span>CHICAGO {mockMatchData.momentum.homePoints}</span>
        <span>BROOKLYN {mockMatchData.momentum.awayPoints}</span>
      </div>
      <div className={styles.momentumStats}>
        {mockMatchData.momentum.stats.map(([label, value]) => (
          <span key={label}>
            <b>{value}</b>
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}
