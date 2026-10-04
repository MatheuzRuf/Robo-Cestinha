import { Fragment } from 'react';
import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { LockerTeam } from '../../../types/team';
import { PlayerStatNet } from './PlayerStatNet';
import styles from './TeamRoster.module.css';

interface TeamRosterProps {
  team: LockerTeam;
  expandedPlayerId: string | null;
  onTogglePlayer: (playerId: string) => void;
}

const positionOrder = ['PG', 'SG', 'SF', 'PF', 'C'];

export function TeamRoster({ team, expandedPlayerId, onTogglePlayer }: TeamRosterProps) {
  const { t, locale } = useTranslation();
  const players = [...team.players].sort((left, right) => {
    if (left.isStarter !== right.isStarter) return left.isStarter ? -1 : 1;
    const positionDifference = positionOrder.indexOf(left.position) - positionOrder.indexOf(right.position);
    return positionDifference || left.name.localeCompare(right.name, locale);
  });
  const formatPercentage = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);

  return (
    <Card className={styles.card}>
      <header className={styles.heading}>
        <h2>{t('team_locker.roster.title')}</h2>
        <span className={styles.meta}>{t('team_locker.roster.player_count', { count: players.length })}</span>
      </header>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('team_locker.roster.position')}</th>
              <th scope="col">{t('team_locker.roster.player')}</th>
              <th scope="col">{t('team_locker.roster.status')}</th>
              <th scope="col">{t('team_locker.roster.two_point')}</th>
              <th scope="col">{t('team_locker.roster.three_point')}</th>
              <th scope="col">{t('team_locker.roster.free_throw')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const isExpanded = expandedPlayerId === player.id;
              const toggleId = `player-toggle-${player.id}`;
              const profileId = `player-profile-${player.id}`;

              return (
                <Fragment key={player.id}>
                  <tr
                    className={styles.playerRow}
                    data-selected={isExpanded}
                    data-alternate={index % 2 === 1}
                    onClick={() => onTogglePlayer(player.id)}
                  >
                    <th scope="row" className={styles.position}>
                      {player.position}
                    </th>
                    <td>
                      <button
                        id={toggleId}
                        className={styles.playerButton}
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={profileId}
                      >
                        {player.name}
                      </button>
                    </td>
                    <td className={styles.role} data-starter={player.isStarter}>
                      {player.isStarter ? t('team_locker.roster.starter') : t('team_locker.roster.non_starter')}
                    </td>
                    <td>{formatPercentage(player.attributes.twoPointPct)}</td>
                    <td>{formatPercentage(player.attributes.threePointPct)}</td>
                    <td>{formatPercentage(player.attributes.freeThrowPct)}</td>
                  </tr>
                  <tr className={styles.expandedRow} hidden={!isExpanded}>
                    <td className={styles.profileCell} colSpan={6}>
                      <div id={profileId} className={styles.profilePanel} role="region" aria-labelledby={toggleId}>
                        {isExpanded ? <PlayerStatNet player={player} embedded /> : null}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!expandedPlayerId ? <p className={styles.hint}>{t('team_locker.roster.select_player')}</p> : null}
    </Card>
  );
}
