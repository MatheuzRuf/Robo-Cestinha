import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { TextInput } from '../../../components/TextInput';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { Club } from '../types';
import styles from './TeamSelectionPanel.module.css';

interface TeamSelectionPanelProps {
  team: Club;
  coachHandle: string;
  hasSavedSelection: boolean;
  isSaving: boolean;
  error: string | null;
  onCoachHandleChange: (value: string) => void;
  onConfirm: () => void;
}

export function TeamSelectionPanel({
  team,
  coachHandle,
  hasSavedSelection,
  isSaving,
  error,
  onCoachHandleChange,
  onConfirm,
}: TeamSelectionPanelProps) {
  const { t } = useTranslation();
  const teamName = t(team.nameKey);

  return (
    <Card className={styles.panel}>
      {team.status === 'locked_by_you' ? (
        <div className={styles.savedMessage} role="status">
          <strong>{t('team_locker.selection.locked_in', { team: teamName })}</strong>
          <span>{t('team_locker.status.locked_by_you')}</span>
        </div>
      ) : team.status === 'locked_by_other' ? (
        <div className={styles.savedMessage} role="status">
          <strong>{t('team_locker.selection.locked_by_other')}</strong>
          <span>{t('team_locker.status.locked_by_other', { coach: team.lockedBy ?? '' })}</span>
        </div>
      ) : hasSavedSelection ? (
        <div className={styles.savedMessage} role="status">
          <strong>{t('team_locker.selection.already_locked')}</strong>
          <span>{t('team_locker.selection.immutable')}</span>
        </div>
      ) : (
        <>
          <div className={styles.formContent}>
            <TextInput
              label={t('team_locker.selection.coach_handle')}
              hint={t('team_locker.selection.handle_hint')}
              placeholder={t('team_locker.selection.handle_placeholder')}
              value={coachHandle}
              onChange={onCoachHandleChange}
            />
            {error ? (
              <p className={styles.error} role="alert">
                {t(error)}
              </p>
            ) : null}
          </div>
          <Button
            variant="primary"
            fullWidth
            disabled={isSaving || !coachHandle.trim()}
            onClick={onConfirm}
            icon={<span aria-hidden="true">♙</span>}
          >
            {isSaving ? t('team_locker.selection.saving') : t('team_locker.selection.lock_in', { team: teamName })}
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
