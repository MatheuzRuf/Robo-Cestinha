import { API_BASE_URL } from '../config/api';
import type { SimulationResponse } from '../types/matchBroadcast';

export interface RunSimulationInput {
  matchId: string;
  sessionHash: string;
  iterations: number;
  signal?: AbortSignal;
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
      throw new Error(`Simulation request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SimulationResponse;
    if (
      !Array.isArray(payload.frames) ||
      payload.frames.length === 0 ||
      !Array.isArray(payload.players) ||
      !Array.isArray(payload.events)
    ) {
      throw new Error('Simulation response did not include frames, events, and player metadata');
    }

    return payload;
  },
};
