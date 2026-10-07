import { useState } from 'react';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { StatusBadge } from '../../../../components/StatusBadge';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { MatchStreamStatus } from '../../../../types/matchBroadcast';
import styles from '../../MatchBroadcast.module.css';

interface BroadcastHeaderProps {
  matchMeta?: string;
  status: MatchStreamStatus;
}

export function BroadcastHeader({ matchMeta, status }: BroadcastHeaderProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('live');
  const statusKey =
    status === 'connected'
      ? 'connected'
      : status === 'reconnecting'
        ? 'reconnecting'
        : status === 'error'
          ? 'error'
          : 'connecting';
  const tone = status === 'connected' ? 'live' : status === 'error' ? 'complete' : 'paused';

  return (
    <section className={styles.broadcastHeader}>
      <div className={styles.headerIdentity}>
        <StatusBadge tone={tone} icon="●">
          {t(`match_broadcast.header.${statusKey}`)}
        </StatusBadge>
        <span>{matchMeta ?? t('match_broadcast.header.waiting_for_match')}</span>
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
      </div>
    </section>
  );
}
