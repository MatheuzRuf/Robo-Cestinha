import { useLayoutEffect, useMemo, useRef } from 'react';
import { NbaImage } from '../../../../components/NbaImage';
import { useTranslation } from '../../../../lib/i18n/i18n';
import type { SimulationEvent, SimulationPlayer, SimulationResponse } from '../../../../types/matchBroadcast';
import styles from './SimulationEvents.module.css';

interface SimulationEventsProps {
  events: SimulationEvent[];
  players: SimulationPlayer[];
  teams: SimulationResponse['teams'];
  currentIteration: number;
}

const TECHNICAL_EVENTS = new Set(['possession_changed']);
const SCORING_EVENTS = new Set(['shot_made']);
const REBOUND_EVENTS = new Set(['rebound']);
const TURNOVER_EVENTS = new Set(['turnover', 'pass_intercepted']);

function eventAccentClass(type: string) {
  if (SCORING_EVENTS.has(type)) return styles.eventScore;
  if (REBOUND_EVENTS.has(type)) return styles.eventRebound;
  if (TURNOVER_EVENTS.has(type)) return styles.eventTurnover;
  return '';
}

export function SimulationEvents({ events, players, teams, currentIteration }: SimulationEventsProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLElement>(null);
  const isFollowingLatest = useRef(true);
  const playersById = useMemo(() => new Map(players.map((player) => [player.playerId, player])), [players]);
  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => event.iteration <= currentIteration && !TECHNICAL_EVENTS.has(event.type))
        .sort((first, second) => second.sequence - first.sequence),
    [currentIteration, events],
  );

  useLayoutEffect(() => {
    if (isFollowingLatest.current && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [currentIteration, visibleEvents.length]);

  function teamAbbreviation(teamId: string | null | undefined) {
    if (!teamId) return '';
    if (teamId === teams.home.teamId) return teams.home.abbreviation;
    if (teamId === teams.away.teamId) return teams.away.abbreviation;
    return '';
  }

  function eventMessage(event: SimulationEvent) {
    const player = playersById.get(event.playerId ?? '');
    const target = playersById.get(event.targetPlayerId ?? '');
    const points = Number(event.data.pointsScored ?? event.data.shotValue ?? 2);
    const team = teamAbbreviation(event.teamId);

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
        return target
          ? t('match_broadcast.simulation.event_shot_made_assisted', {
              player: player?.name ?? '',
              points,
              assist: target.name,
            })
          : t('match_broadcast.simulation.event_shot_made', { player: player?.name ?? '', points });
      case 'shot_missed':
        return t('match_broadcast.simulation.event_shot_missed', { player: player?.name ?? '', points });
      case 'rebound': {
        const isOffensive = event.data.reboundType === 'offensive';
        if (player) {
          return t(
            isOffensive
              ? 'match_broadcast.simulation.event_rebound_offensive'
              : 'match_broadcast.simulation.event_rebound_defensive',
            { player: player.name },
          );
        }
        return t(
          isOffensive
            ? 'match_broadcast.simulation.event_rebound_team_offensive'
            : 'match_broadcast.simulation.event_rebound_team_defensive',
          { team },
        );
      }
      case 'turnover':
        return target
          ? t('match_broadcast.simulation.event_steal', {
              player: player?.name ?? '',
              defender: target.name,
            })
          : t('match_broadcast.simulation.event_turnover', { player: player?.name ?? '' });
      case 'pass_intercepted':
        return target
          ? t('match_broadcast.simulation.event_pass_intercepted', {
              player: player?.name ?? '',
              defender: target.name,
            })
          : t('match_broadcast.simulation.event_pass_intercepted_unknown', { player: player?.name ?? '' });
      case 'foul':
        return target
          ? t('match_broadcast.simulation.event_foul_on', {
              player: player?.name ?? '',
              defender: target.name,
            })
          : t('match_broadcast.simulation.event_foul', { player: player?.name ?? '' });
      case 'overtime_started':
        return t('match_broadcast.simulation.event_overtime_started');
      case 'game_finished':
        return t('match_broadcast.simulation.event_game_finished', { team });
      default:
        return t('match_broadcast.simulation.event_other');
    }
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      onScroll={(event) => {
        isFollowingLatest.current = event.currentTarget.scrollTop <= 1;
      }}
      aria-label={t('match_broadcast.simulation.events_title', {
        visible: visibleEvents.length,
        total: events.length,
      })}
    >
      <h2 className={styles.heading}>
        {t('match_broadcast.simulation.events_title', {
          visible: visibleEvents.length,
          total: events.length,
        })}
      </h2>
      {visibleEvents.length === 0 ? (
        <p className={styles.empty}>{t('match_broadcast.simulation.events_empty')}</p>
      ) : (
        <ol className={styles.list}>
          {visibleEvents.map((event) => {
            const player = playersById.get(event.playerId ?? '');
            return (
              <li
                className={`${styles.event} ${eventAccentClass(event.type)} ${
                  event.iteration === currentIteration ? styles.currentEvent : ''
                }`}
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
