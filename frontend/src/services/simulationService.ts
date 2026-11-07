import { API_BASE_URL } from '../config/api';
import type { SimulationResponse } from '../types/matchBroadcast';

export interface RunSimulationInput {
  matchId: string;
  sessionHash: string;
  iterations: number;
  signal?: AbortSignal;
}

export class SimulationRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Simulation request failed with status ${status}`);
    this.name = 'SimulationRequestError';
    this.status = status;
  }
}

function validatePayload(payload: SimulationResponse): SimulationResponse {
  if (
    !Array.isArray(payload.frames) ||
    payload.frames.length === 0 ||
    !Array.isArray(payload.players) ||
    !Array.isArray(payload.events)
  ) {
    throw new Error('Simulation response did not include frames, events, and player metadata');
  }

  return payload;
}

export const simulationService = {
  async runSimulation({ matchId, sessionHash, iterations, signal }: RunSimulationInput): Promise<SimulationResponse> {
    const response = await fetch(`${API_BASE_URL}/matches/${encodeURIComponent(matchId)}/simulation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionHash, iterations }),
      signal,
    });

    if (!response.ok) {
      throw new SimulationRequestError(response.status);
    }

    return validatePayload((await response.json()) as SimulationResponse);
  },

  async getSimulation({
    matchId,
    sessionHash,
    signal,
  }: {
    matchId: string;
    sessionHash: string;
    signal?: AbortSignal;
  }): Promise<SimulationResponse | null> {
    const query = new URLSearchParams({ session_hash: sessionHash });
    const response = await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(matchId)}/simulation?${query}`,
      { signal },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new SimulationRequestError(response.status);
    }

    return validatePayload((await response.json()) as SimulationResponse);
  },
};
