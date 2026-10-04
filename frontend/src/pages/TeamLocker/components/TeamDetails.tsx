import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { LockerTeam } from '../../../types/team';
import styles from './TeamDetails.module.css';

export function TeamDetails({ team }: { team: LockerTeam }) {
  const { t, locale } = useTranslation();
  const statistics = [
    { label: t('team_locker.team_statistics.pace'), value: team.statistics.pace },
    { label: t('team_locker.team_statistics.offensive_rating'), value: team.statistics.offensiveRating },
    { label: t('team_locker.team_statistics.defensive_rating'), value: team.statistics.defensiveRating },
  ];

  return (
    <Card className={styles.overviewCard}>
      <div className={styles.teamHeader}>
        <div className={styles.teamIdentity}>
          <div className={styles.teamAbbreviation} aria-hidden="true">
            {team.abbreviation}
          </div>
          <div className={styles.teamHeading}>
            <div className={styles.eyebrow}>
              <span>{team.season}</span>
            </div>
            <h2>{team.name}</h2>
          </div>
        </div>
      </div>

      <div className={styles.ratings}>
        {statistics.map((statistic) => (
          <div className={styles.ratingCard} key={statistic.label}>
            <span className={styles.ratingLabel}>{statistic.label}</span>
            <strong>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(statistic.value)}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}
