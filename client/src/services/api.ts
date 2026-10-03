import type {
  Airport,
  Flight,
  FlightDirection,
  Message,
  SearchParams,
  TrackedFlight,
} from '../models';

/**
 * Where the API is.
 *
 * In development, and anywhere the two halves share an origin, /api is right
 * and Vite proxies it to the Express server (see vite.config.ts).
 *
 * Deployed apart they do not share an origin: a static site has no /api of
 * its own, so asking for one returns the site's own index.html and every
 * request fails as a parse error rather than as a missing server. That is
 * what VITE_API_URL is for, read at build time like every Vite variable, so
 * it must be set wherever the client is built rather than where it is served.
 */
export const apiBase = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '/api';

/** Shape the Express error handlers return. */
interface ApiErrorBody {
  error: string;
  details?: string[];
}

/**
 * A request that did not work.
 *
 * Carries the status when something answered and nothing when nothing did,
 * which is the difference between a condition of the site, such as the flight
 * allowance being spent, and a dead connection.
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly body?: ApiErrorBody;

  constructor(message: string, { status, body }: { status?: number; body?: ApiErrorBody } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | undefined>;

function urlFor(path: string, query?: Query) {
  // A relative base resolves against the page; an absolute one ignores the
  // second argument entirely, so both forms go through the same line.
  const url = new URL(`${apiBase}${path}`, window.location.origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  return url;
}

/**
 * One request, and every way it can fail.
 *
 * A GET carries no Content-Type. That header is not on the list a browser
 * will send cross-origin without asking first, so putting it on a GET turns
 * every search into two round trips: a preflight and then the request. There
 * is no body on a GET to describe anyway.
 */
async function request<T>(path: string, { query, body }: { query?: Query; body?: unknown } = {}) {
  let response: Response;

  try {
    response = await fetch(urlFor(path, query), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when nothing answered at all.
    throw new ApiError('The request never reached the server.');
  }

  if (!response.ok) {
    // A failure that is not JSON is a failure all the same, and the page has
    // its own wording for one it cannot read.
    const parsed = await response.json().catch(() => undefined);
    throw new ApiError(`The server answered ${response.status}.`, {
      status: response.status,
      body: parsed as ApiErrorBody | undefined,
    });
  }

  return (await response.json()) as T;
}

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
  return request<HealthResponse>('/health');
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
  return request<FlightSearchResponse>('/flights', {
    query: {
      airport: params.airport,
      direction: params.direction,
      from: params.fromLocal,
      to: params.toLocal,
    },
  });
}

export interface ChatResponse {
  reply: string;
}

/**
 * Sends the conversation and returns the assistant's reply. Only role and
 * content go over the wire; timestamps are ours for rendering, and the server
 * caps history anyway.
 *
 * The airport, when one is being looked at, is context for the system prompt
 * rather than a lookup: the assistant still has no flight data, and asking it
 * for any would spend quota this app deliberately keeps apart.
 */
export async function sendChat(
  messages: Pick<Message, 'role' | 'content'>[],
  airport?: string,
): Promise<string> {
  const { reply } = await request<ChatResponse>('/chat', {
    body: {
      messages: messages.map(({ role, content }) => ({ role, content })),
      ...(airport ? { airport } : {}),
    },
  });

  return reply;
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
  return request<FlightNumberResponse>(`/flights/number/${encodeURIComponent(number)}`, {
    query: { date },
  });
}

export interface AirportSearchResponse {
  query: string;
  count: number;
  airports: Airport[];
}

/** Runs against bundled data on our server, so it costs no upstream quota. */
export async function searchAirports(query: string): Promise<Airport[]> {
  const { airports } = await request<AirportSearchResponse>('/airports', { query: { q: query } });
  return airports;
}

/**
 * The HTTP status behind a failure, when there was one.
 *
 * Used to tell a site-wide condition, such as the flight data allowance being
 * spent, from something wrong with this one request.
 */
export function errorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

/**
 * Turns a failed request into something worth showing a user. The server
 * already writes messages for people rather than for logs, so prefer its
 * text over anything invented here.
 */
export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === undefined) return 'Could not reach the server. Is it running?';

    const body = error.body;
    if (body?.details?.length) return body.details.join('. ');
    if (body?.error) return body.error;
  }

  return 'Something went wrong. Try again.';
}
