import axios from 'axios';

import type { Flight, FlightDirection, SearchParams } from '../models';

/** Requests go to /api and are proxied to the Express server in dev (see vite.config.ts). */
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface HealthResponse {
  status: string;
  service: string;
  uptime: number;
  integrations: {
    aeroDataBox: boolean;
    anthropic: boolean;
  };
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

export interface FlightSearchResponse {
  airport: string;
  direction: FlightDirection;
  from: string;
  to: string;
  count: number;
  flights: Flight[];
}

export async function searchFlights(params: SearchParams): Promise<FlightSearchResponse> {
  const { data } = await api.get<FlightSearchResponse>('/flights', {
    params: {
      airport: params.airport,
      direction: params.direction,
      from: params.fromLocal,
      to: params.toLocal,
    },
  });

  return data;
}

/** Shape the Express error handlers return. */
interface ApiErrorBody {
  error: string;
  details?: string[];
}

/**
 * Turns a failed request into something worth showing a user. The server
 * already writes messages for people rather than for logs, so prefer its
 * text over anything invented here.
 */
export function messageFromError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.code === 'ERR_NETWORK') return 'Could not reach the server. Is it running?';

    const body = error.response?.data;
    if (body?.details?.length) return body.details.join('. ');
    if (body?.error) return body.error;
  }

  return 'Something went wrong. Try again.';
}
