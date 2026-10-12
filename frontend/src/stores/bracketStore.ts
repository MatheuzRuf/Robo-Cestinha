import { create } from 'zustand';
import { bracketService, BracketServiceError } from '../services/bracketService';
import type { BracketContext, BracketSnapshot } from '../types/bracket';

type BracketStatus = 'idle' | 'loading' | 'ready' | 'error';

interface BracketStoreState {
  sessionHash: string | null;
  userId: string | null;
  bracket: BracketSnapshot | null;
  status: BracketStatus;
  isGenerating: boolean;
  errorKey: string | null;
  loadBracket: (context: BracketContext) => Promise<void>;
  generateBracket: (context: BracketContext) => Promise<void>;
  reset: () => void;
}

let loadSequence = 0;

function getErrorKey(error: unknown, action: 'load' | 'generate') {
  if (!(error instanceof BracketServiceError)) {
    return action === 'load' ? 'bracket_tree.errors.load_failed' : 'bracket_tree.errors.generate_failed';
  }

  switch (error.message) {
    case 'session_not_found':
      return 'bracket_tree.errors.session_not_found';
    case 'bracket_already_generated':
      return 'bracket_tree.errors.already_generated';
    default:
      return action === 'load' ? 'bracket_tree.errors.load_failed' : 'bracket_tree.errors.generate_failed';
  }
}

export const useBracketStore = create<BracketStoreState>((set, get) => ({
  sessionHash: null,
  userId: null,
  bracket: null,
  status: 'idle',
  isGenerating: false,
  errorKey: null,

  async loadBracket(context) {
    const sequence = ++loadSequence;
    const sameContext = get().sessionHash === context.sessionHash && get().userId === context.userId;
    set({
      sessionHash: context.sessionHash,
      userId: context.userId,
      bracket: sameContext ? get().bracket : null,
      status: 'loading',
      errorKey: null,
    });

    try {
      const bracket = await bracketService.getBracket(context);
      if (sequence !== loadSequence) return;
      set({ bracket, status: 'ready' });
    } catch (error) {
      if (sequence !== loadSequence) return;
      set({ status: 'error', errorKey: getErrorKey(error, 'load') });
    }
  },

  async generateBracket(context) {
    if (get().sessionHash !== context.sessionHash || get().userId !== context.userId || get().isGenerating) {
      return;
    }

    set({ isGenerating: true, errorKey: null });
    try {
      const bracket = await bracketService.generateBracket(context);
      if (get().sessionHash !== context.sessionHash || get().userId !== context.userId) return;
      set({ bracket, status: 'ready' });
    } catch (error) {
      if (get().sessionHash !== context.sessionHash || get().userId !== context.userId) return;
      set({ errorKey: getErrorKey(error, 'generate') });
    } finally {
      if (get().sessionHash === context.sessionHash && get().userId === context.userId) {
        set({ isGenerating: false });
      }
    }
  },

  reset() {
    loadSequence += 1;
    set({
      sessionHash: null,
      userId: null,
      bracket: null,
      status: 'idle',
      isGenerating: false,
      errorKey: null,
    });
  },
}));
