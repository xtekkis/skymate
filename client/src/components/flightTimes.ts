import type { Flight } from '../models';

/**
 * The wall clock, read straight off an airport-local string.
 *
 * Parsing it into a Date would re-render it in the browser's timezone, which
 * is the bug scheduledLocal exists to avoid.
 */
export function localTime(iso?: string) {
  return iso ? iso.slice(11, 16) : '--:--';
}

/**
 * The revised time, or null when there is nothing to revise.
 *
 * AeroDataBox often sends a revised time identical to the scheduled one, for a
 * flight that is simply on time. Showing that struck through beside itself
 * would announce a change that never happened.
 */
export function revisedTime(flight: Pick<Flight, 'scheduledLocal' | 'revisedLocal'>) {
  if (!flight.revisedLocal || flight.revisedLocal === flight.scheduledLocal) return null;
  return localTime(flight.revisedLocal);
}
