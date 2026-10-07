import { API_BASE_URL } from '../config/api';
import type { BroadcastEvent, MatchStreamStatus } from '../types/matchBroadcast';

type EventHandler = (event: BroadcastEvent) => void;
type StatusHandler = (status: MatchStreamStatus) => void;

const EVENT_TYPES = new Set(['snapshot', 'frame', 'match_update', 'play_by_play', 'commentary']);

function isBroadcastEvent(value: unknown): value is BroadcastEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.sequence === 'number' &&
    typeof event.occurredAt === 'string' &&
    typeof event.type === 'string' &&
    EVENT_TYPES.has(event.type) &&
    typeof event.payload === 'object' &&
    event.payload !== null
  );
}

export const matchBroadcastService = {
  connect(matchId: string, onEvent: EventHandler, onStatus: StatusHandler) {
    const url = new URL(`${API_BASE_URL}/matches/stream`);
    url.searchParams.set('match_id', matchId);

    onStatus('connecting');
    const source = new EventSource(url);

    source.onopen = () => onStatus('connected');
    source.onmessage = (message) => {
      try {
        const event: unknown = JSON.parse(message.data);
        if (!isBroadcastEvent(event)) {
          onStatus('error');
          return;
        }
        onEvent(event);
      } catch {
        onStatus('error');
      }
    };
    source.onerror = () => {
      onStatus(source.readyState === EventSource.CLOSED ? 'error' : 'reconnecting');
    };

    return () => source.close();
  },
};
