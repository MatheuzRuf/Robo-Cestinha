import { LogPanel } from '../../../../components/LogPanel';
import styles from './CourtActionLog.module.css';

export interface ActionLogEntry {
  id: string;
  time: string;
  team: string;
  player: string;
  description: string;
}

interface CourtActionLogProps {
  title: string;
  liveLabel: string;
  entries: ActionLogEntry[];
  broadcaster: string;
  audioLabel: string;
}

export function CourtActionLog({ title, liveLabel, entries, broadcaster, audioLabel }: CourtActionLogProps) {
  return (
    <LogPanel
      title={title}
      entriesKey={entries.map((entry) => entry.id).join(',')}
      headerAction={<span className={styles.liveIndicator} aria-label={liveLabel} />}
      footer={
        <div className={styles.footer}>
          <span>{broadcaster}</span>
          <span>{audioLabel}</span>
        </div>
      }
    >
      {entries.map((entry) => (
        <article className={styles.entry} key={entry.id}>
          <time>{entry.time}</time>
          <div>
            <strong>
              {entry.team} · {entry.player}
            </strong>
            <p>{entry.description}</p>
          </div>
        </article>
      ))}
    </LogPanel>
  );
}
