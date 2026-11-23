import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Moon, Sun, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../lib/i18n/i18n';
import { useTheme } from '../../lib/theme/useTheme';
import styles from './AppShell.module.css';

interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree';
  hasLockedTeam: boolean;
  isMatchRoute?: boolean;
  isMatchPlayback?: boolean;
  onlineCount?: { current: number; total: number };
  currentUserName?: string;
  sessionName?: string;
  sessionCode?: string;
  sessionActionLabel?: string;
  onSessionAction?: () => void;
  children: ReactNode;
}

export function AppShell({
  activeNavItem,
  hasLockedTeam,
  isMatchRoute = false,
  isMatchPlayback = false,
  onlineCount,
  currentUserName,
  sessionName,
  sessionCode,
  sessionActionLabel,
  onSessionAction,
  children,
}: AppShellProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeToggleLabel = t(theme === 'dark' ? 'shell.switch_to_light_theme' : 'shell.switch_to_dark_theme');

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
    {
      id: 'bracketTree',
      label: t(isMatchRoute ? 'shell.nav_back_to_bracket' : 'shell.nav_bracket_tree'),
      path: '/bracket-tree',
    },
  ];

  return (
    <div className={`${styles.shell} ${isMatchPlayback ? styles.matchShell : ''}`} data-active-nav-item={activeNavItem}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>{t('shell.brand_title')}</div>
          <div className={styles.brandSubtitle}>{t('shell.brand_subtitle')}</div>
        </div>
        <div className={styles.navBar}>
          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isDisabled = item.id === 'bracketTree' && !hasLockedTeam;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.id === 'home'}
                  className={styles.navItem}
                  data-active={activeNavItem === item.id}
                  aria-disabled={isDisabled}
                  aria-current={
                    activeNavItem === item.id && !(isMatchRoute && item.id === 'bracketTree') ? 'page' : undefined
                  }
                  onClick={(event) => {
                    if (isDisabled) event.preventDefault();
                  }}
                >
                  {item.label}
                </NavLink>
              );
            })}
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
            {currentUserName ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userMenuTrigger}
                  disabled={!onSessionAction}
                  aria-expanded={isUserMenuOpen}
                  aria-controls={isUserMenuOpen ? 'session-user-menu' : undefined}
                  onClick={() => {
                    if (onSessionAction) setIsUserMenuOpen((open) => !open);
                  }}
                >
                  {t('shell.hello_user', { name: currentUserName })}
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {isUserMenuOpen && onSessionAction ? (
                  <div className={styles.userMenuPopover} id="session-user-menu">
                    {onSessionAction ? (
                      <button
                        type="button"
                        className={styles.userMenuItem}
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onSessionAction();
                        }}
                      >
                        {sessionActionLabel ?? t('shell.leave_session')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.themeToggle}
              aria-label={themeToggleLabel}
              aria-pressed={theme === 'light'}
              title={themeToggleLabel}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
