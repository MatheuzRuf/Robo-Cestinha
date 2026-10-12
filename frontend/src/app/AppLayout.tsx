import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useSessionStore } from '../stores/sessionStore';

export default function AppLayout() {
  const { pathname } = useLocation();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );

  const activeNavItem =
    pathname === '/team-locker'
      ? 'teamLocker'
      : pathname === '/bracket-tree'
        ? 'bracketTree'
        : pathname === '/match-demo' || pathname.startsWith('/matches/')
          ? 'liveBroadcast'
          : 'home';

  return (
    <AppShell
      activeNavItem={activeNavItem}
      currentUserName={activeSession?.userName}
      sessionName={activeSession?.sessionName}
      sessionCode={activeSession?.sessionHash}
      onLeaveSession={() => useSessionStore.getState().leaveSession()}
    >
      <Outlet />
    </AppShell>
  );
}
