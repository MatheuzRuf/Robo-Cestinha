import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { LockerTeam } from '../../../types/team';
import styles from './TeamSelectionPanel.module.css';

interface TeamSelectionPanelProps {
  team: LockerTeam;
  myTeam: LockerTeam | null;
  isLocking: boolean;
  errorKey: string | null;
  onConfirm: () => void;
}

export function TeamSelectionPanel({ team, myTeam, isLocking, errorKey, onConfirm }: TeamSelectionPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className={styles.panel}>
      {myTeam ? (
        <div className={styles.savedMessage} role="status">
          <strong>{t('team_locker.selection.locked_in', { team: myTeam.name })}</strong>
          <span>{t('team_locker.status.locked_by_you')}</span>
        </div>
      ) : team.claimStatus === 'locked_by_other' ? (
        <div className={styles.savedMessage} role="status">
          <strong>{t('team_locker.selection.locked_by_other')}</strong>
          <span>{t('team_locker.status.locked_by_other')}</span>
        </div>
      ) : (
        <>
          {errorKey ? (
            <p className={styles.error} role="alert">
              {t(errorKey)}
            </p>
          ) : null}
          <Button
            variant="primary"
            fullWidth
            disabled={isLocking || team.claimStatus !== 'available'}
            onClick={onConfirm}
            icon={<span aria-hidden="true">♙</span>}
          >
            {isLocking ? t('team_locker.selection.saving') : t('team_locker.selection.lock_in', { team: team.name })}
          </Button>
          <p className={styles.notice}>
            <span aria-hidden="true">⚠</span>
            {t('team_locker.selection.immutable')}
          </p>
        </>
      )}
    </Card>
  );
}
