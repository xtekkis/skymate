import { config } from './config.js';

const API_HOST = 'aerodatabox.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;
const REQUEST_TIMEOUT_MS = 10_000;

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
 * Fetches one airport's schedule for a local time window, which AeroDataBox
 * caps at 12 hours. Times are local to the airport, formatted YYYY-MM-DDTHH:mm.
 *
 * Returns the raw upstream movement objects. Shaping into the Flight model is
 * the mapper's job, not this one's.
 */
export async function fetchAirportSchedule({ airport, direction, fromLocal, toLocal }) {
  if (!config.rapidApiKey) {
    throw new UpstreamError('Flight data is not configured on this server.', 503);
  }

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

  const body = await response.json();
  return body[isArrival ? 'arrivals' : 'departures'] ?? [];
}
