import type { FlightDirection, SearchParams } from '../models';

/**
 * A window of the board, as the controls hold it.
 *
 * Five fields the reader actually sets, kept apart from the two-timestamp
 * shape the API wants. The board needs the date and the start time in their
 * own right, to know whether now falls on it and where the axis begins, and
 * recovering those by subtracting two timestamps is how the window quietly
 * became twelve hours across a daylight saving change once already.
 */
export interface BoardQuery {
  /** IATA code, uppercase. */
  airport: string;
  direction: FlightDirection;
  /** YYYY-MM-DD at the airport. */
  date: string;
  /** HH:MM at the airport: the left edge of the axis. */
  time: string;
  windowHours: number;
}

/** AeroDataBox caps a query window at 12 hours. */
export const WINDOWS = [4, 8, 12] as const;

/** What we fall back to when a restored window is not one we offer. */
const WIDEST = 12;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * Adds hours to a wall-clock date and time, rolling the date over when needed.
 *
 * Done in UTC on purpose. These are times at the airport, in a zone this
 * browser knows nothing about, so bringing the browser's own zone into it only
 * adds daylight saving to arithmetic that should be plain addition.
 */
export function addHours(date: string, time: string, hours: number) {
  const end = new Date(`${date}T${time}:00Z`);
  end.setUTCHours(end.getUTCHours() + hours);
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

/** The window as the API takes it: two airport-local timestamps. */
export function paramsFor({
  airport,
  direction,
  date,
  time,
  windowHours,
}: BoardQuery): SearchParams {
  return {
    airport: airport.trim().toUpperCase(),
    direction,
    fromLocal: `${date}T${time}`,
    toLocal: addHours(date, time, windowHours),
  };
}

/**
 * The controls again, from a window that came back in a link.
 *
 * UTC on both sides, for the same reason addHours uses it. Measured in the
 * browser's zone, a four hour window shared across a daylight saving change
 * comes back as three, misses the list of windows, and silently becomes twelve.
 */
export function queryFrom(params: SearchParams | null | undefined): BoardQuery | null {
  if (!params) return null;

  const hours = Math.round(
    (new Date(`${params.toLocal}:00Z`).getTime() - new Date(`${params.fromLocal}:00Z`).getTime()) /
      3_600_000,
  );

  return {
    airport: params.airport,
    direction: params.direction,
    date: params.fromLocal.slice(0, 10),
    time: params.fromLocal.slice(11, 16),
    windowHours: WINDOWS.includes(hours as (typeof WINDOWS)[number]) ? hours : WIDEST,
  };
}
