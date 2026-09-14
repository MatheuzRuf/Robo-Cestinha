import type { ReactNode } from 'react';
import { useTranslation } from '../../lib/i18n/i18n';
import styles from './AppShell.module.css';

interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree' | 'liveBroadcast';
  onlineCount?: { current: number; total: number };
  sessionCode?: string;
  tickerText?: string;
  children: ReactNode;
}

export function AppShell({ activeNavItem, onlineCount, sessionCode, tickerText, children }: AppShellProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.shell} data-active-nav-item={activeNavItem}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>{t('shell.brand_title')}</div>
          <div className={styles.brandSubtitle}>{t('shell.brand_subtitle')}</div>
        </div>
        <nav className={styles.nav}>
          <span data-active={activeNavItem === 'home'}>{t('shell.nav_home')}</span>
          <span data-active={activeNavItem === 'teamLocker'}>{t('shell.nav_team_locker')}</span>
          <span data-active={activeNavItem === 'bracketTree'}>{t('shell.nav_bracket_tree')}</span>
          <span data-active={activeNavItem === 'liveBroadcast'}>{t('shell.nav_live_broadcast')}</span>
        </nav>
        <div className={styles.utilityRow}>
          {onlineCount ? <span className={styles.pill}>◉ {t('shell.online_teams', { count: onlineCount.current, total: onlineCount.total })}</span> : null}
          {sessionCode ? <span className={styles.pill}>{t('shell.session_code', { code: sessionCode })}</span> : null}
          <button className={styles.iconButton} type="button" aria-label={t('common.sound')}>🔊</button>
          <button className={styles.iconButton} type="button" aria-label={t('common.profile')}>☺</button>
        </div>
      </header>
      {tickerText ? <div className={styles.ticker}><span>{t('shell.ticker_label')}</span><span>{tickerText}</span></div> : null}
      {children}
    </div>
  );
}
