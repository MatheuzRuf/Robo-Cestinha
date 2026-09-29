import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../lib/i18n/i18n';
import styles from './AppShell.module.css';

interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree' | 'liveBroadcast';
  onlineCount?: { current: number; total: number };
  sessionCode?: string;
  tickerText?: string;
  children: ReactNode;
}

export function AppShell({ activeNavItem, onlineCount, sessionCode, children }: AppShellProps) {
  const { t } = useTranslation();
  const navItems: {
    id: AppShellProps['activeNavItem'];
    label: string;
    path?: string;
  }[] = [
    { id: 'home', label: t('shell.nav_home'), path: '/' },
    { id: 'teamLocker', label: t('shell.nav_team_locker') },
    { id: 'bracketTree', label: t('shell.nav_bracket_tree'), path: '/bracket-tree' },
    { id: 'liveBroadcast', label: t('shell.nav_live_broadcast'), path: '/match-demo' },
  ];

  return (
    <div className={styles.shell} data-active-nav-item={activeNavItem}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>{t('shell.brand_title')}</div>
          <div className={styles.brandSubtitle}>{t('shell.brand_subtitle')}</div>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) =>
            item.path ? (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.id === 'home'}
                className={styles.navItem}
                data-active={activeNavItem === item.id}
                aria-current={activeNavItem === item.id ? 'page' : undefined}
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.id}
                className={styles.navItem}
                data-active={activeNavItem === item.id}
                aria-disabled="true"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className={styles.utilityRow}>
          {onlineCount ? (
            <span className={styles.pill}>
              ◉ {t('shell.online_teams', { count: onlineCount.current, total: onlineCount.total })}
            </span>
          ) : null}
          {sessionCode ? <span className={styles.pill}>{t('shell.session_code', { code: sessionCode })}</span> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
