import { create } from 'zustand';
import type { Frame } from '../types/game';
import type {
  BroadcastEvent,
  CommentaryEntry,
  MatchSnapshot,
  MatchStreamStatus,
  PlayByPlayLogEntry,
} from '../types/matchBroadcast';

const MAX_LOG_ENTRIES = 50;

interface MatchBroadcastState {
  matchId: string | null;
  snapshot: MatchSnapshot | null;
  frame: Frame | null;
  playByPlay: PlayByPlayLogEntry[];
  commentary: CommentaryEntry[];
  status: MatchStreamStatus;
  reset: (matchId: string) => void;
  setStatus: (status: MatchStreamStatus) => void;
  receiveEvent: (event: BroadcastEvent) => void;
}

export const useMatchBroadcastStore = create<MatchBroadcastState>((set) => ({
  matchId: null,
  snapshot: null,
  frame: null,
  playByPlay: [],
  commentary: [],
  status: 'idle',

  reset(matchId) {
    set({
      matchId,
      snapshot: null,
      frame: null,
      playByPlay: [],
      commentary: [],
      status: 'connecting',
    });
  },

  setStatus(status) {
    set({ status });
  },

  receiveEvent(event) {
    set((state) => {
      switch (event.type) {
        case 'snapshot':
          return {
            snapshot: event.payload,
            frame: event.payload.frame,
            playByPlay: event.payload.playByPlay.slice(-MAX_LOG_ENTRIES),
            commentary: event.payload.commentary.slice(-MAX_LOG_ENTRIES),
          };
        case 'frame':
          return { frame: event.payload };
        case 'match_update':
          return state.snapshot ? { snapshot: { ...state.snapshot, ...event.payload } } : state;
        case 'play_by_play':
          return { playByPlay: [...state.playByPlay, event.payload].slice(-MAX_LOG_ENTRIES) };
        case 'commentary':
          return { commentary: [...state.commentary, event.payload].slice(-MAX_LOG_ENTRIES) };
      }
    });
  },
}));
