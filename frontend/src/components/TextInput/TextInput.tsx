import type { ReactNode } from 'react';
import styles from './TextInput.module.css';

interface TextInputProps {
  label?: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  trailingAction?: { icon: ReactNode; label: string; onClick: () => void };
}

export function TextInput({ label, hint, placeholder, value, onChange, trailingAction }: TextInputProps) {
  return (
    <label className={styles.root}>
      {(label || hint) && (
        <div className={styles.header}>
          {label ? <span className={styles.label}>{label}</span> : <span />}
          {hint ? <span className={styles.hint}>{hint}</span> : null}
        </div>
      )}
      <div className={styles.field}>
        <input
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {trailingAction ? (
          <button
            className={styles.trailing}
            type="button"
            onClick={trailingAction.onClick}
            aria-label={trailingAction.label}
          >
            {trailingAction.icon}
          </button>
        ) : null}
      </div>
    </label>
  );
}
