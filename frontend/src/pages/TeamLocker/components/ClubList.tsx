import { useTranslation } from '../../../lib/i18n/i18n';
import type { Club } from '../types';
import styles from './ClubList.module.css';

interface ClubListProps {
  teams: Club[];
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
}

export function ClubList({ teams, selectedTeamId, onSelect }: ClubListProps) {
  const { t } = useTranslation();
  const availableTeams = teams.filter((team) => team.status === 'available');
  const lockedTeams = teams.filter((team) => team.status !== 'available');

  return (
    <div className={styles.listColumn}>
      <section aria-labelledby="available-clubs-heading">
        <div className={styles.sectionHeading}>
          <h2 id="available-clubs-heading">
            <span className={styles.headingIcon} aria-hidden="true">
              ◈
            </span>
            {t('team_locker.available_clubs')}
          </h2>
          <span className={styles.countBadge}>{t('team_locker.open_slots', { count: availableTeams.length })}</span>
        </div>
        <div className={styles.clubList}>
          {availableTeams.map((team) => (
            <ClubRow key={team.id} team={team} selected={selectedTeamId === team.id} onSelect={onSelect} />
          ))}
        </div>
      </section>

      <section className={styles.lockedSection} aria-labelledby="locked-clubs-heading">
        <div className={styles.lockedHeading}>
          <h2 id="locked-clubs-heading">
            <span aria-hidden="true">♙</span>
            {t('team_locker.locked_clubs')}
          </h2>
        </div>
        <div className={styles.lockedList}>
          {lockedTeams.map((team) => (
            <ClubRow key={team.id} team={team} selected={selectedTeamId === team.id} onSelect={onSelect} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ClubRow({ team, selected, onSelect }: { team: Club; selected: boolean; onSelect: (teamId: string) => void }) {
  const { t } = useTranslation();
  const locked = team.status !== 'available';
  const statusLabel =
    team.status === 'available'
      ? t('team_locker.status.available')
      : team.status === 'locked_by_you'
        ? t('team_locker.status.locked_by_you')
        : t('team_locker.status.locked_by_other', { coach: team.lockedBy ?? '' });
  const name = t(team.nameKey);

  return (
    <button
      className={styles.clubRow}
      type="button"
      data-selected={selected}
      data-locked={locked}
      aria-pressed={selected}
      aria-label={t('team_locker.select_club', { seed: team.seed, name, status: statusLabel })}
      onClick={() => onSelect(team.id)}
    >
      <span className={styles.seed}>#{team.seed}</span>
      <span className={styles.clubInfo}>
        <span className={styles.location}>{t(team.locationKey)}</span>
        <span className={styles.clubName}>{name}</span>
        <span className={styles.clubStatus}>{statusLabel}</span>
      </span>
      <span className={styles.rowAction} aria-hidden="true">
        {selected ? '✓' : '›'}
      </span>
    </button>
  );
}
