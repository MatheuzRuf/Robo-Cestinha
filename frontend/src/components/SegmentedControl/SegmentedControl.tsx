import styles from './SegmentedControl.module.css';

interface SegmentedControlProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabledValues?: string[];
  layout?: 'stacked' | 'inline';
  size?: 'sm' | 'md';
  hideLabel?: boolean;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  disabledValues = [],
  layout = 'stacked',
  size = 'md',
  hideLabel = false,
}: SegmentedControlProps) {
  return (
    <div className={`${styles.root} ${layout === 'inline' ? styles.inline : ''} ${size === 'sm' ? styles.sm : ''}`.trim()}>
      {hideLabel ? null : <div className={styles.label}>{label}</div>}
      <div className={styles.group} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.option} ${option.value === value ? styles.active : ''}`.trim()}
            onClick={() => onChange(option.value)}
            disabled={disabledValues.includes(option.value)}
            aria-pressed={option.value === value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}