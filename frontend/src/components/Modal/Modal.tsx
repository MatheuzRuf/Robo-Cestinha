import type { ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  closeLabel?: string;
}

export function Modal({ title, children, open, onClose, closeLabel = 'Close' }: ModalProps) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.titleRow}>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
