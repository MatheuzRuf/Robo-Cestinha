import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { useTranslation } from '../../lib/i18n/i18n';
import { useSessionStore } from '../../stores/sessionStore';
import { useTeamStore } from '../../stores/teamStore';
import { ClubList } from './components/ClubList';
import { TeamDetails } from './components/TeamDetails';
import { TeamRoster } from './components/TeamRoster';
import { TeamSelectionPanel } from './components/TeamSelectionPanel';
import styles from './TeamLocker.module.css';

export default function TeamLocker() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const sessionHash = activeSession?.sessionHash ?? null;
  const userId = activeSession?.userId ?? null;
  const context = useMemo(() => (sessionHash && userId ? { sessionHash, userId } : null), [sessionHash, userId]);
  const snapshot = useTeamStore((state) => state.snapshot);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const status = useTeamStore((state) => state.status);
  const isLocking = useTeamStore((state) => state.isLocking);
  const errorKey = useTeamStore((state) => state.errorKey);
  const loadLocker = useTeamStore((state) => state.loadLocker);
  const selectTeam = useTeamStore((state) => state.selectTeam);
  const lockSelectedTeam = useTeamStore((state) => state.lockSelectedTeam);
  const reset = useTeamStore((state) => state.reset);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (context) {
      void loadLocker(context);
      return;
    }
    reset();
  }, [context, loadLocker, reset]);

  const selectedTeam = snapshot?.teams.find((team) => team.id === selectedTeamId) ?? null;
  const myTeam = snapshot?.teams.find((team) => team.id === snapshot.myTeamId) ?? null;

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!context) throw new Error('session_not_active');
      return lockSelectedTeam(context);
    },
    onSuccess: (updatedSnapshot) => {
      if (context) {
        useSessionStore.getState().setTeamForSession(context.sessionHash, updatedSnapshot.myTeamId);
      }
    },
  });

  const handleSelectTeam = (teamId: string) => {
    selectTeam(teamId);
    setExpandedPlayerId(null);
  };

  return (
    <AppShell
      activeNavItem="teamLocker"
      currentUserName={activeSession?.userName}
      sessionCode={activeSession?.sessionHash}
    >
      <main className={styles.page}>
        {!activeSession ? (
          <div className={styles.emptyState}>
            <p>{t('team_locker.no_active_session')}</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              {t('team_locker.go_to_home')}
            </Button>
          </div>
        ) : status === 'loading' || status === 'idle' ? (
          <p className={styles.statusMessage} role="status">
            {t('team_locker.loading')}
          </p>
        ) : status === 'error' || !snapshot ? (
          <div className={styles.errorState} role="alert">
            <p>{t('team_locker.load_failed')}</p>
            <Button variant="outline" onClick={() => context && void loadLocker(context)}>
              {t('team_locker.retry')}
            </Button>
          </div>
        ) : (
          <div className={styles.lockerGrid}>
            <ClubList teams={snapshot.teams} selectedTeamId={selectedTeamId} onSelect={handleSelectTeam} />

            <div className={styles.detailsColumn}>
              {selectedTeam ? (
                <>
                  <TeamDetails team={selectedTeam} />
                  <TeamRoster
                    team={selectedTeam}
                    expandedPlayerId={expandedPlayerId}
                    onTogglePlayer={(playerId) =>
                      setExpandedPlayerId((currentId) => (currentId === playerId ? null : playerId))
                    }
                  />
                  <TeamSelectionPanel
                    team={selectedTeam}
                    myTeam={myTeam ?? null}
                    isLocking={isLocking || lockMutation.isPending}
                    errorKey={errorKey}
                    onConfirm={() => lockMutation.mutate()}
                  />
                </>
              ) : (
                <div className={styles.emptyState}>{t('team_locker.empty_selection')}</div>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
