import { useEffect, useRef, type ReactNode } from 'react';
import { Card } from '../Card';
import styles from './LogPanel.module.css';

type LogPanelProps = {
  title: string;
  entriesKey: string;
  children: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
};

export function LogPanel({ title, entriesKey, children, headerAction, footer }: LogPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(true);

  useEffect(() => {
    if (shouldScrollToBottom.current) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }
  }, [entriesKey]);

  function handleScroll() {
    const log = logRef.current;
    if (!log) return;

    shouldScrollToBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  }

  return (
    <Card className={styles.card}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        {headerAction}
      </div>
      <div className={styles.log} ref={logRef} onScroll={handleScroll}>
        {children}
      </div>
      {footer}
    </Card>
  );
}
