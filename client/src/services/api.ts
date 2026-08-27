import axios from 'axios';

import type {
  Airport,
  Flight,
  FlightDirection,
  Message,
  SearchParams,
  TrackedFlight,
} from '../models';

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

export interface ChatResponse {
  reply: string;
}

/**
 * Sends the conversation and returns the assistant's reply. Only role and
 * content go over the wire; timestamps are ours for rendering, and the server
 * caps history anyway.
 */
export async function sendChat(messages: Pick<Message, 'role' | 'content'>[]): Promise<string> {
  const { data } = await api.post<ChatResponse>('/chat', {
    messages: messages.map(({ role, content }) => ({ role, content })),
  });

  return data.reply;
}

export interface FlightNumberResponse {
  number: string;
  date?: string;
  count: number;
  flights: TrackedFlight[];
}

/** Every leg flying under one number. An unknown number returns an empty list. */
export async function getFlightByNumber(
  number: string,
  date?: string,
): Promise<FlightNumberResponse> {
  const { data } = await api.get<FlightNumberResponse>(
    `/flights/number/${encodeURIComponent(number)}`,
    date ? { params: { date } } : undefined,
  );

  return data;
}

export interface AirportSearchResponse {
  query: string;
  count: number;
  airports: Airport[];
}

/** Runs against bundled data on our server, so it costs no upstream quota. */
export async function searchAirports(query: string): Promise<Airport[]> {
  const { data } = await api.get<AirportSearchResponse>('/airports', { params: { q: query } });
  return data.airports;
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
