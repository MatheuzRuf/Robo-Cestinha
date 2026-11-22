import { useEffect, useId, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  closeLabel?: string;
}

export function Modal({ title, children, open, onClose, closeLabel = 'Close' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.titleRow}>
          <h2 id={titleId}>{title}</h2>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
