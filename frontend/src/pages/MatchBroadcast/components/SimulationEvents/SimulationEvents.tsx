import { useMemo } from 'react';
import { NbaImage } from '../../../../components/NbaImage';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { SimulationEvent, SimulationPlayer } from '../../../../types/matchBroadcast';
import styles from './SimulationEvents.module.css';

interface SimulationEventsProps {
  events: SimulationEvent[];
  players: SimulationPlayer[];
  currentIteration: number;
}

export function SimulationEvents({ events, players, currentIteration }: SimulationEventsProps) {
  const { t } = useTranslation();
  const playersById = useMemo(() => new Map(players.map((player) => [player.playerId, player])), [players]);
  const visibleEvents = useMemo(
    () =>
      [...events].sort((first, second) => {
        const firstIsCurrent = first.iteration === currentIteration;
        const secondIsCurrent = second.iteration === currentIteration;
        if (firstIsCurrent !== secondIsCurrent) return firstIsCurrent ? -1 : 1;
        return second.sequence - first.sequence;
      }),
    [currentIteration, events],
  );

  function eventMessage(event: SimulationEvent) {
    const player = playersById.get(event.playerId ?? '');
    const target = playersById.get(event.targetPlayerId ?? '');
    const points = Number(event.data.pointsScored ?? event.data.shotValue ?? 2);

    switch (event.type) {
      case 'game_started':
        return t('match_broadcast.simulation.event_game_started');
      case 'possession_started':
        return t('match_broadcast.simulation.event_possession_started', { player: player?.name ?? '' });
      case 'dribble':
        return t('match_broadcast.simulation.event_dribble', { player: player?.name ?? '' });
      case 'pass_completed':
        return t('match_broadcast.simulation.event_pass_completed', {
          player: player?.name ?? '',
          target: target?.name ?? '',
        });
      case 'shot_attempted':
        return t('match_broadcast.simulation.event_shot_attempted', { player: player?.name ?? '', points });
      case 'shot_made':
        return t('match_broadcast.simulation.event_shot_made', { player: player?.name ?? '', points });
      case 'shot_missed':
        return t('match_broadcast.simulation.event_shot_missed', { player: player?.name ?? '', points });
      case 'rebound':
        return t('match_broadcast.simulation.event_rebound', { player: player?.name ?? '' });
      default:
        return t('match_broadcast.simulation.event_other');
    }
  }

  return (
    <section
      className={styles.panel}
      aria-label={t('match_broadcast.simulation.events_title', { count: events.length })}
    >
      <h2 className={styles.heading}>{t('match_broadcast.simulation.events_title', { count: events.length })}</h2>
      {visibleEvents.length === 0 ? (
        <p className={styles.empty}>{t('match_broadcast.simulation.events_empty')}</p>
      ) : (
        <ol className={styles.list}>
          {visibleEvents.map((event) => {
            const player = playersById.get(event.playerId ?? '');
            return (
              <li
                className={`${styles.event} ${event.iteration === currentIteration ? styles.currentEvent : ''}`}
                key={event.sequence}
                aria-current={event.iteration === currentIteration ? 'step' : undefined}
              >
                <span className={styles.sequence}>{event.sequence}</span>
                {player ? (
                  <NbaImage
                    kind="player"
                    nbaId={player.nbaPlayerId}
                    alt=""
                    fallback={player.name}
                    className={styles.eventPlayer}
                  />
                ) : null}
                <span className={styles.eventMessage}>{eventMessage(event)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
