import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { Club } from '../types';
import styles from './StartingFive.module.css';

export function StartingFive({ team }: { team: Club }) {
  const { t } = useTranslation();

  return (
    <Card className={styles.card}>
      <header className={styles.heading}>
        <h2>
          <span aria-hidden="true">♟</span>
          {t('team_locker.starting_five')}
        </h2>
        <span className={styles.meta}>{t('team_locker.archetypes_active')}</span>
      </header>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('team_locker.columns.position')}</th>
              <th scope="col">{t('team_locker.columns.player_name')}</th>
              <th scope="col">{t('team_locker.columns.overall')}</th>
              <th scope="col">{t('team_locker.columns.specialty')}</th>
              <th scope="col">{t('team_locker.columns.badge')}</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((player) => (
              <tr key={player.id}>
                <th scope="row" className={styles.position}>
                  {player.position}
                </th>
                <td className={styles.playerName}>{player.name}</td>
                <td>
                  <span className={styles.overall}>{player.overall}</span>
                </td>
                <td className={styles.archetype}>{t(player.archetypeKey)}</td>
                <td className={styles.badge} aria-label={t('team_locker.player_badge', { name: player.name })}>
                  <span aria-hidden="true">{player.badge}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
