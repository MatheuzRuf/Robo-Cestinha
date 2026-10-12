import { API_BASE_URL } from '../config/api';
import type { BracketContext, BracketSnapshot } from '../types/bracket';

export class BracketServiceError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'BracketServiceError';
  }
}

async function readBracket(response: Response): Promise<BracketSnapshot> {
  if (response.ok) return (await response.json()) as BracketSnapshot;

  let code = 'request_failed';
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === 'string') code = payload.detail;
  } catch {
    code = 'request_failed';
  }

  throw new BracketServiceError(code);
}

export const bracketService = {
  async getBracket(context: BracketContext): Promise<BracketSnapshot> {
    const query = new URLSearchParams({ user_id: context.userId });
    const response = await fetch(`${API_BASE_URL}/bracket/${encodeURIComponent(context.sessionHash)}?${query}`);
    return readBracket(response);
  },

  async generateBracket(context: BracketContext): Promise<BracketSnapshot> {
    const response = await fetch(`${API_BASE_URL}/bracket/${encodeURIComponent(context.sessionHash)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: context.userId }),
    });
    return readBracket(response);
  },
};
