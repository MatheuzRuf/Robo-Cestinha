import styles from './Chip.module.css';

export function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button className={styles.chip} type="button" onClick={onClick}>
        {label}
      </button>
    );
  }

  return <span className={styles.chip}>{label}</span>;
}
