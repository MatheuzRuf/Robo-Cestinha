import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { AppShell } from '../components/AppShell';
import { Modal } from '../components/Modal';
import { useTranslation } from '../lib/i18n/i18n';
import { sessionService } from '../services/sessionService';
import { useSessionStore } from '../stores/sessionStore';

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isSessionActionOpen, setIsSessionActionOpen] = useState(false);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const recentSessions = useSessionStore((state) => state.recentSessions);
  const reconcileSavedSessions = useSessionStore((state) => state.reconcileSavedSessions);
  const savedMemberships = useMemo(
    () => recentSessions.map(({ sessionHash, userId }) => ({ sessionHash, userId })),
    [recentSessions],
  );
  const savedSessionValidationQuery = useQuery({
    queryKey: ['savedSessionValidation', savedMemberships],
    queryFn: () => sessionService.validateSavedSessions(savedMemberships),
    enabled: savedMemberships.length > 0,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const sessionDescriptorQuery = useQuery({
    queryKey: ['sessionDescriptor', activeSession?.sessionHash],
    queryFn: () => (activeSession ? sessionService.findSession(activeSession.sessionHash) : Promise.resolve(null)),
    enabled: Boolean(activeSession),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (savedSessionValidationQuery.data) {
      reconcileSavedSessions(savedSessionValidationQuery.data);
    }
  }, [reconcileSavedSessions, savedSessionValidationQuery.data]);
  const ownerUserId = sessionDescriptorQuery.data?.ownerUserId ?? null;
  const isSessionOwner = Boolean(activeSession && ownerUserId === activeSession.userId);

  const sessionActionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession || !ownerUserId) throw new Error('session_action_failed');
      if (isSessionOwner) {
        await sessionService.deleteSession(activeSession.sessionHash, activeSession.userId);
      } else {
        await sessionService.leaveSession(activeSession.sessionHash, activeSession.userId);
      }
      return activeSession.sessionHash;
    },
    onSuccess: (sessionHash) => {
      useSessionStore.getState().removeSession(sessionHash);
      setIsSessionActionOpen(false);
      setSessionActionError(null);
      navigate('/');
    },
    onError: (error) => {
      const code = error instanceof Error ? error.message : 'session_action_failed';
      setSessionActionError(`shell.session_action.errors.${code}`);
    },
  });

  const isMatchRoute = pathname.startsWith('/matches/');
  const isMatchPlayback = /^\/matches\/[^/]+$/.test(pathname);
  const activeNavItem =
    pathname === '/team-locker' ? 'teamLocker' : pathname === '/bracket-tree' || isMatchRoute ? 'bracketTree' : 'home';
  const requiresTeam = pathname === '/bracket-tree' || isMatchRoute;

  if (activeSession && requiresTeam && !activeSession.teamId) {
    return <Navigate to="/team-locker" replace />;
  }

  return (
    <AppShell
      activeNavItem={activeNavItem}
      hasLockedTeam={Boolean(activeSession?.teamId)}
      isMatchRoute={isMatchRoute}
      isMatchPlayback={isMatchPlayback}
      sessionActionLabel={t(isSessionOwner ? 'shell.delete_session' : 'shell.leave_session')}
      currentUserName={activeSession?.userName}
      sessionName={activeSession?.sessionName}
      sessionCode={activeSession?.sessionHash}
      onSessionAction={
        activeSession && ownerUserId
          ? () => {
              setSessionActionError(null);
              setIsSessionActionOpen(true);
            }
          : undefined
      }
    >
      <>
        <Outlet />
        <Modal
          title={t(isSessionOwner ? 'shell.session_action.delete_title' : 'shell.session_action.leave_title')}
          open={isSessionActionOpen}
          onClose={() => {
            if (!sessionActionMutation.isPending) setIsSessionActionOpen(false);
          }}
          closeLabel={t('common.close')}
        >
          <p>
            {t(isSessionOwner ? 'shell.session_action.delete_description' : 'shell.session_action.leave_description')}
          </p>
          {sessionActionError ? <p role="alert">{t(sessionActionError)}</p> : null}
          <Button
            variant="primary"
            fullWidth
            disabled={sessionActionMutation.isPending}
            onClick={() => sessionActionMutation.mutate()}
          >
            {t(
              sessionActionMutation.isPending
                ? 'shell.session_action.submitting'
                : isSessionOwner
                  ? 'shell.session_action.delete_confirm'
                  : 'shell.session_action.leave_confirm',
            )}
          </Button>
        </Modal>
      </>
    </AppShell>
  );
}
