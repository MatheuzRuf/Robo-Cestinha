import type { ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline';
  icon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: ReactNode;
}

export function Button({
  variant,
  icon,
  fullWidth,
  disabled = false,
  type = 'button',
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`.trim()}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
