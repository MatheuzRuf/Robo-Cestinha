import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree' | 'liveBroadcast';
  onlineCount?: { current: number; total: number };
  sessionCode?: string;
  tickerText?: string;
  children: ReactNode;
}

export function AppShell({ activeNavItem, onlineCount, sessionCode, tickerText, children }: AppShellProps) {
  return (
    <div className={styles.shell} data-active-nav-item={activeNavItem}>
      {onlineCount ? <div data-online-count={`${onlineCount.current}/${onlineCount.total}`} /> : null}
      {sessionCode ? <div data-session-code={sessionCode} /> : null}
      {tickerText ? <div data-ticker-text={tickerText} /> : null}
      {children}
    </div>
  );
}
