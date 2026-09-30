import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { Club } from '../types';
import styles from './TeamDetails.module.css';

export function TeamDetails({ team }: { team: Club }) {
  const { t } = useTranslation();
  const name = t(team.nameKey);
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

  return (
    <Card className={styles.overviewCard}>
      <div className={styles.teamHeader}>
        <div className={styles.teamIdentity}>
          <div className={styles.teamMark} data-mark={team.palette[1]} aria-hidden="true">
            {initials}
          </div>
          <div className={styles.teamHeading}>
            <div className={styles.eyebrow}>
              <span>{t('team_locker.seed_overall', { seed: team.seed })}</span>
              <span>{t(team.conferenceKey)}</span>
            </div>
            <h2>{name}</h2>
            <p className={styles.motto}>
              “{t(team.mottoKey)}” <span>·</span> {t(team.arenaKey)}
            </p>
          </div>
        </div>
        <div className={styles.palette}>
          <span>{t('team_locker.club_palette')}</span>
          <div className={styles.swatches} aria-label={t('team_locker.club_palette')}>
            {team.palette.map((tone, index) => (
              <span className={styles.swatch} data-tone={tone} key={`${team.id}-color-${index}`} />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.ratings}>
        {team.ratings.map((rating) => (
          <div className={styles.ratingCard} key={rating.category}>
            <div className={styles.ratingHeading}>
              <span>{t(`team_locker.ratings.${rating.category}`)}</span>
              <strong>{rating.value}</strong>
            </div>
            <progress
              className={styles.ratingMeter}
              data-category={rating.category}
              value={rating.value}
              max={100}
              aria-label={t('team_locker.rating_value', {
                rating: t(`team_locker.ratings.${rating.category}`),
                value: rating.value,
              })}
            />
            <span className={styles.ratingRank}>{t('team_locker.league_rank', { rank: rating.rank })}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
