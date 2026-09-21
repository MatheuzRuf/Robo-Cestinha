import type { ReactNode } from 'react';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  tone: 'live' | 'complete' | 'paused' | 'info';
  icon?: ReactNode;
  children: ReactNode;
}

export function StatusBadge({ tone, icon, children }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`.trim()}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {children}
    </span>
  );
}
