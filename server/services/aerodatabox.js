import { createTtlCache } from './cache.js';
import { config } from './config.js';

const API_HOST = 'aerodatabox.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Schedules shift as flights are revised, so hold them briefly. Long enough to
 * absorb a refresh or a repeated search, short enough that a delay still shows.
 */
const scheduleCache = createTtlCache({ ttlMs: 60_000, maxEntries: 50 });

/** Carries the status the route layer should answer with. */
export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/**
 * Maps an AeroDataBox status onto something safe to return.
 * Auth failures become a generic 502 so a key problem never reaches the client.
 */
function translate(status) {
  if (status === 400) return new UpstreamError('That airport code or time window was rejected.', 400);
  if (status === 404) return new UpstreamError('No schedule found for that airport.', 404);
  if (status === 429) return new UpstreamError('Flight data rate limit reached. Try again shortly.', 429);
  if (status === 401 || status === 403) {
    console.error('[skymate] AeroDataBox rejected our credentials (HTTP %d)', status);
    return new UpstreamError('Flight data is unavailable right now.', 502);
  }
  return new UpstreamError('Flight data is unavailable right now.', 502);
}

/**
 * One place for the request, the timeout, and the error translation, so a
 * second endpoint cannot quietly drift from the first.
 */
async function requestJson(url) {
  if (!config.rapidApiKey) {
    throw new UpstreamError('Flight data is not configured on this server.', 503);
  }

  let response;

  try {
    response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': config.rapidApiKey,
        'X-RapidAPI-Host': API_HOST,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new UpstreamError('Flight data timed out. Try again.', 504);
    }
    console.error('[skymate] AeroDataBox request failed:', error.message);
    throw new UpstreamError('Flight data is unavailable right now.', 502);
  }

  if (!response.ok) {
    throw translate(response.status);
  }

  // An empty result comes back with an empty body, not an empty structure.
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError('Flight data could not be read.', 502);
  }
}

/**
 * Looks up every leg flying under one flight number, optionally on a given
 * local date. The response is a list because a number can fly more than one
 * leg, and because without a date the API may return neighbouring days.
 *
 * Returns the raw legs. Shaping is the mapper's job.
 */
export async function fetchFlightByNumber({ number, date }) {
  // "BA 117" and "ba117" are the same flight; the path wants it unspaced.
  const normalized = String(number).replace(/\s+/g, '').toUpperCase();
  const path = date
    ? `/flights/number/${encodeURIComponent(normalized)}/${encodeURIComponent(date)}`
    : `/flights/number/${encodeURIComponent(normalized)}`;

  const url = new URL(API_BASE + path);
  url.searchParams.set('withAircraftImage', 'false');
  url.searchParams.set('withLocation', 'false');

  const cacheKey = url.toString();
  const cached = scheduleCache.get(cacheKey);
  if (cached) return cached;

  const body = await requestJson(url);
  const legs = Object.freeze(Array.isArray(body) ? body : []);

  scheduleCache.set(cacheKey, legs);
  return legs;
}

/**
 * Fetches one airport's schedule for a local time window, which AeroDataBox
 * caps at 12 hours. Times are local to the airport, formatted YYYY-MM-DDTHH:mm.
 *
 * Returns the raw upstream movement objects. Shaping into the Flight model is
 * the mapper's job, not this one's.
 */
export async function fetchAirportSchedule({ airport, direction, fromLocal, toLocal }) {
  const isArrival = direction === 'arrival';
  const url = new URL(
    `${API_BASE}/flights/airports/iata/${encodeURIComponent(airport)}/${fromLocal}/${toLocal}`,
  );
  url.searchParams.set('direction', isArrival ? 'Arrival' : 'Departure');
  url.searchParams.set('withCancelled', 'true');
  // Codeshares repeat the same physical flight under other airlines' numbers.
  url.searchParams.set('withCodeshared', 'false');
  url.searchParams.set('withCargo', 'false');
  url.searchParams.set('withPrivate', 'false');
  url.searchParams.set('withLocation', 'false');

  // The URL carries every query parameter and no credentials, so it keys cleanly.
  const cacheKey = url.toString();
  const cached = scheduleCache.get(cacheKey);
  if (cached) return cached;

  const body = await requestJson(url);

  // Frozen because callers share this array: an in-place sort would corrupt the
  // cache for everyone. Shallow, which is enough to stop the mutating methods.
  const rows = Object.freeze(body?.[isArrival ? 'arrivals' : 'departures'] ?? []);

  scheduleCache.set(cacheKey, rows);
  return rows;
}
