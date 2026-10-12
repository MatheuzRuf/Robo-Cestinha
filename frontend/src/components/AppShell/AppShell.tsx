import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../lib/i18n/i18n';
import styles from './AppShell.module.css';

interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree' | 'liveBroadcast';
  onlineCount?: { current: number; total: number };
  currentUserName?: string;
  sessionName?: string;
  sessionCode?: string;
  onLeaveSession?: () => void;
  tickerText?: string;
  children: ReactNode;
}

export function AppShell({
  activeNavItem,
  onlineCount,
  currentUserName,
  sessionName,
  sessionCode,
  onLeaveSession,
  tickerText,
  children,
}: AppShellProps) {
  const { t } = useTranslation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuRef.current?.querySelector('button')?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isUserMenuOpen]);

  const navItems: {
    id: AppShellProps['activeNavItem'];
    label: string;
    path: string;
  }[] = [
    { id: 'home', label: t('shell.nav_home'), path: '/' },
    { id: 'teamLocker', label: t('shell.nav_team_locker'), path: '/team-locker' },
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
        <div className={styles.navBar}>
          <nav className={styles.nav}>
            {navItems.map((item) => (
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
            ))}
          </nav>
          <div className={styles.utilityRow}>
            {!currentUserName && onlineCount ? (
              <span className={styles.pill}>
                <UsersRound size={14} aria-hidden="true" />{' '}
                {t('shell.online_teams', { count: onlineCount.current, total: onlineCount.total })}
              </span>
            ) : null}
            {sessionCode ? (
              <div className={styles.sessionDetails}>
                <span className={styles.sessionName}>{sessionName ?? t('shell.default_session_name')}</span>
                <span className={styles.sessionCode}>{t('shell.session_code', { code: sessionCode })}</span>
              </div>
            ) : null}
            {currentUserName && onLeaveSession ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userMenuTrigger}
                  aria-expanded={isUserMenuOpen}
                  aria-controls={isUserMenuOpen ? 'session-user-menu' : undefined}
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                >
                  {t('shell.hello_user', { name: currentUserName })}
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {isUserMenuOpen ? (
                  <div className={styles.userMenuPopover} id="session-user-menu">
                    <button
                      type="button"
                      className={styles.userMenuItem}
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLeaveSession();
                      }}
                    >
                      {t('shell.leave_session')}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {children}
      {tickerText ? (
        <footer className={styles.ticker} aria-label={t('shell.ticker_label')}>
          <strong>{t('shell.ticker_label')}</strong>
          <span>{tickerText}</span>
        </footer>
      ) : null}
    </div>
  );
}
