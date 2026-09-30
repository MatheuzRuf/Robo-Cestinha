import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { useTranslation } from '../../lib/i18n/i18n';
import { ClubList } from './components/ClubList';
import { StartingFive } from './components/StartingFive';
import { TeamDetails } from './components/TeamDetails';
import { TeamSelectionPanel } from './components/TeamSelectionPanel';
import { teamService } from './services/teamService';
import type { TeamLockerData } from './types';
import styles from './TeamLocker.module.css';

export default function TeamLocker() {
  const { t } = useTranslation();
  const [locker, setLocker] = useState<TeamLockerData | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [coachHandle, setCoachHandle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'success' | 'failure' | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const data = await teamService.getLockerData();
        if (data.teams.length !== 8) {
          throw new Error('Team locker must contain exactly eight clubs.');
        }
        if (!isActive) return;
        setLocker(data);
        setSelectedTeamId(data.myTeamId ?? data.initialSelectedTeamId ?? data.teams[0]?.id ?? null);
        setIsLoading(false);
      } catch {
        if (!isActive) return;
        setLoadFailed(true);
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [loadAttempt]);

  const selectedTeam = useMemo(
    () => locker?.teams.find((team) => team.id === selectedTeamId) ?? null,
    [locker, selectedTeamId],
  );

  const availableCount = locker?.teams.filter((team) => team.status === 'available').length ?? 0;
  const totalCount = locker?.teams.length ?? 8;
  const lockedCount = totalCount - availableCount;

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectionError(null);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleCopyInvite = async () => {
    if (!locker) return;
    const inviteUrl = `${window.location.origin}/team-locker?session=${encodeURIComponent(locker.sessionCode)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus('success');
    } catch {
      setCopyStatus('failure');
    }
  };

  const handleLockIn = async () => {
    if (!locker || !selectedTeam || !coachHandle.trim() || selectedTeam.status !== 'available') return;

    setIsSaving(true);
    setSelectionError(null);
    try {
      await teamService.selectTeam(locker.sessionCode, selectedTeam.id, coachHandle.trim());
      setLocker((current) => {
        if (!current) return current;
        return {
          ...current,
          myTeamId: selectedTeam.id,
          teams: current.teams.map((team) =>
            team.id === selectedTeam.id ? { ...team, status: 'locked_by_you', lockedBy: coachHandle.trim() } : team,
          ),
        };
      });
    } catch {
      setSelectionError('team_locker.selection.save_failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      activeNavItem="teamLocker"
      onlineCount={locker?.onlineCount}
      sessionCode={locker?.sessionCode}
      tickerText={t('shell.ticker_text')}
    >
      <main className={styles.page}>
        {isLoading ? (
          <p className={styles.statusMessage} role="status">
            {t('team_locker.loading')}
          </p>
        ) : loadFailed || !locker ? (
          <div className={styles.errorState} role="alert">
            <p>{t('team_locker.load_failed')}</p>
            <Button variant="outline" onClick={handleRetry}>
              {t('team_locker.retry')}
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.lockerGrid}>
              <ClubList teams={locker.teams} selectedTeamId={selectedTeamId} onSelect={handleSelectTeam} />

              <div className={styles.detailsColumn}>
                {selectedTeam ? (
                  <>
                    <TeamDetails team={selectedTeam} />
                    <StartingFive team={selectedTeam} />
                    <TeamSelectionPanel
                      team={selectedTeam}
                      coachHandle={coachHandle}
                      hasSavedSelection={locker.myTeamId !== null}
                      isSaving={isSaving}
                      error={selectionError}
                      onCoachHandleChange={setCoachHandle}
                      onConfirm={() => void handleLockIn()}
                    />
                  </>
                ) : (
                  <div className={styles.emptyState}>{t('team_locker.empty_selection')}</div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
