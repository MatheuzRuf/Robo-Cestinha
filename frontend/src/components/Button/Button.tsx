import type { ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline';
  icon?: ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: ReactNode;
}

export function Button({
  variant,
  icon,
  fullWidth,
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${size === 'sm' ? styles.sm : ''} ${
        fullWidth ? styles.fullWidth : ''
      }`.trim()}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
