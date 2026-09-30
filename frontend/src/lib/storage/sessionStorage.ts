import type { StateStorage } from 'zustand/middleware';

const SESSION_STORE_KEY = 'robo-cestinha-session-state';

export function ensureSessionStorageAvailable() {
  const probeKey = `${SESSION_STORE_KEY}:write-check`;
  try {
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
  } catch {
    try {
      window.localStorage.removeItem(probeKey);
    } catch {
      // Ignore cleanup failures; report the original storage failure.
    }
    throw new Error('session_storage_unavailable');
  }
}

export const sessionStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },

  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      throw new Error('session_storage_unavailable');
    }
  },

  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      throw new Error('session_storage_unavailable');
    }
  },
};
