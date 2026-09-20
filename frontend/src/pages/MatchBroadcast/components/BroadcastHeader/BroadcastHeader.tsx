import { useState } from 'react';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { StatusBadge } from '../../../../components/StatusBadge';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

export function BroadcastHeader() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('live');

  return (
    <section className={styles.broadcastHeader}>
      <div className={styles.headerIdentity}>
        <StatusBadge tone="live" icon="●">
          {t('match_broadcast.header.live_label')}
        </StatusBadge>
        <span>{t('match_broadcast.header.game_meta')}</span>
      </div>
      <div className={styles.headerControls}>
        <SegmentedControl
          label=""
          options={[
            { value: 'live', label: t('match_broadcast.header.mode_live') },
            { value: 'replay', label: t('match_broadcast.header.mode_replay') },
          ]}
          value={mode}
          onChange={setMode}
          disabledValues={['replay']}
        />
        <span className={styles.latency}>{t('match_broadcast.header.latency_label', { value: 18 })}</span>
      </div>
    </section>
  );
}
