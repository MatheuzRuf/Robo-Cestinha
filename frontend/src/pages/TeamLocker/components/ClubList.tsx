import { useTranslation } from '../../../lib/i18n/i18n';
import type { LockerTeam } from '../../../types/team';
import styles from './ClubList.module.css';

interface ClubListProps {
  teams: LockerTeam[];
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
}

export function ClubList({ teams, selectedTeamId, onSelect }: ClubListProps) {
  const { t } = useTranslation();
  const availableTeams = teams.filter((team) => team.claimStatus === 'available');
  const lockedTeams = teams.filter((team) => team.claimStatus !== 'available');

  return (
    <div className={styles.listColumn}>
      <section aria-labelledby="available-clubs-heading">
        <div className={styles.sectionHeading}>
          <h2 id="available-clubs-heading">
            <span className={styles.headingIcon} aria-hidden="true">
              ◈
            </span>
            {t('team_locker.available_teams')}
          </h2>
          <span className={styles.countBadge}>{t('team_locker.open_slots', { count: availableTeams.length })}</span>
        </div>
        <div className={styles.clubList}>
          {availableTeams.map((team) => (
            <ClubRow key={team.id} team={team} selected={selectedTeamId === team.id} onSelect={onSelect} />
          ))}
        </div>
      </section>

      <section className={styles.lockedSection} aria-labelledby="claimed-teams-heading">
        <div className={styles.lockedHeading}>
          <h2 id="claimed-teams-heading">
            <span aria-hidden="true">♙</span>
            {t('team_locker.claimed_teams')}
          </h2>
        </div>
        {lockedTeams.length ? (
          <div className={styles.lockedList}>
            {lockedTeams.map((team) => (
              <ClubRow key={team.id} team={team} selected={selectedTeamId === team.id} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <p className={styles.noClaimedTeams}>{t('team_locker.no_claimed_teams')}</p>
        )}
      </section>
    </div>
  );
}

function ClubRow({
  team,
  selected,
  onSelect,
}: {
  team: LockerTeam;
  selected: boolean;
  onSelect: (teamId: string) => void;
}) {
  const { t } = useTranslation();
  const locked = team.claimStatus !== 'available';
  const statusLabel =
    team.claimStatus === 'available'
      ? t('team_locker.status.available')
      : team.claimStatus === 'locked_by_you'
        ? t('team_locker.status.locked_by_you')
        : t('team_locker.status.locked_by_other');

  return (
    <button
      className={styles.clubRow}
      type="button"
      data-selected={selected}
      data-locked={locked}
      aria-pressed={selected}
      aria-label={t('team_locker.select_team', { name: team.name, status: statusLabel })}
      onClick={() => onSelect(team.id)}
    >
      <span className={styles.abbreviation}>{team.abbreviation}</span>
      <span className={styles.clubInfo}>
        <span className={styles.clubName}>{team.name}</span>
        <span className={styles.clubStatus}>{statusLabel}</span>
      </span>
      <span className={styles.rowAction} aria-hidden="true">
        {selected ? '✓' : '›'}
      </span>
    </button>
  );
}
