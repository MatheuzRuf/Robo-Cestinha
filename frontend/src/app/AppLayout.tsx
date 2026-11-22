import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useSessionStore } from '../stores/sessionStore';

export default function AppLayout() {
  const { pathname } = useLocation();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );

  const isMatchRoute = pathname.startsWith('/matches/');
  const isMatchPlayback = /^\/matches\/[^/]+$/.test(pathname);
  const activeNavItem =
    pathname === '/team-locker' ? 'teamLocker' : pathname === '/bracket-tree' || isMatchRoute ? 'bracketTree' : 'home';

  return (
    <AppShell
      activeNavItem={activeNavItem}
      isMatchRoute={isMatchRoute}
      isMatchPlayback={isMatchPlayback}
      currentUserName={activeSession?.userName}
      sessionName={activeSession?.sessionName}
      sessionCode={activeSession?.sessionHash}
      onLeaveSession={() => useSessionStore.getState().leaveSession()}
    >
      <Outlet />
    </AppShell>
  );
}
