import styles from './CheckboxRow.module.css';

interface CheckboxRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxRow({ title, description, checked, onChange }: CheckboxRowProps) {
  return (
    <label className={styles.row}>
      <span>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
