import type { Flight } from '../models';

/**
 * Turning a board into the countries it reaches.
 *
 * Separate from the components because a file that exports both a component
 * and plain functions cannot be hot reloaded, and because the grouping is
 * worth testing on its own rather than through a render.
 */

/** What stands for a flight whose far airport has no country on it. */
export const UNKNOWN = '';

export interface CountryGroup {
  /** ISO 3166 alpha-2, uppercase, or UNKNOWN. */
  code: string;
  name: string;
  count: number;
}

/*
 * Built once. A board can hold five hundred flights, and building a formatter
 * per flight to name a dozen countries is most of the work of grouping them.
 */
let names: Intl.DisplayNames | null = null;

function formatter() {
  if (!names) names = new Intl.DisplayNames(['en'], { type: 'region' });
  return names;
}

/**
 * The country's name in English, or the code itself when there is no name for
 * it.
 *
 * Wrapped because a code that is not a region throws rather than returning
 * anything, and one bad code on one flight should not empty the picker.
 */
export function countryName(code: string) {
  if (!code) return 'Unknown';

  try {
    return formatter().of(code) ?? code;
  } catch {
    return code;
  }
}

/** Which country a flight's far airport is in, in the case used here. */
function codeOf(flight: Flight) {
  return flight.counterpart.countryCode?.toUpperCase() || UNKNOWN;
}

/**
 * Where the board's flights go, counted by country, busiest first.
 *
 * Counted over flights already fetched. Asking the API for a country's
 * flights would be a second request for data already on screen.
 *
 * Flights with no country keep a group of their own at the end rather than
 * being dropped. Only one country is shown at a time, so a dropped flight is
 * a flight nobody can reach.
 */
export function toCountries(flights: Flight[]): CountryGroup[] {
  const counts = new Map<string, number>();

  for (const flight of flights) {
    const code = codeOf(flight);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts]
    .map(([code, count]) => ({ code, name: countryName(code), count }))
    .sort((a, b) => {
      // Last whatever its size: it is a gap in the data, not a destination,
      // and it must never be what a search opens on.
      if (a.code === UNKNOWN) return 1;
      if (b.code === UNKNOWN) return -1;

      return b.count - a.count || a.name.localeCompare(b.name);
    });
}

/**
 * The country a fresh search should open on: whichever has the most flights.
 *
 * Null when there is nothing to show, so the caller can tell an empty board
 * from a board waiting on a choice.
 */
export function busiestCountry(flights: Flight[]) {
  return toCountries(flights)[0]?.code ?? null;
}

/** The flights going to one country, with UNKNOWN meaning the ones missing it. */
export function inCountry(flights: Flight[], code: string | null) {
  if (code === null) return flights;
  return flights.filter((flight) => codeOf(flight) === code);
}
