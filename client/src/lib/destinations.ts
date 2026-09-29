import type { Flight } from '../models';

/**
 * Turning a board into the places it goes.
 *
 * Separate from the component because a file that exports both a component
 * and plain functions cannot be hot reloaded, and because these are worth
 * testing on their own terms rather than through a render.
 */

/** Enough to fill two rows without turning the page into a scroll. */
const MAX_CARDS = 8;

export interface Destination {
  iata: string;
  name: string;
  count: number;
  /** Local wall clock at the departure airport, HH:mm. */
  earliest: string;
}

/**
 * A stable hue per destination.
 *
 * Deterministic so a place keeps its colour between searches and sessions:
 * Athens is always the same card, and that is the whole point of colouring
 * them at all. Chroma stays low in the CSS, so this reads as tinted paper
 * rather than as twelve competing accents.
 */
export function hueFor(code: string) {
  let hash = 0;
  for (const character of code) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360;
  }
  return hash;
}

/**
 * Where today's flights actually go, counted from the board that is already
 * loaded. No second request, and so no quota: this is the same data seen a
 * different way.
 */
export function toDestinations(flights: Flight[]): Destination[] {
  const byCode = new Map<string, Destination>();

  for (const flight of flights) {
    const { iata, municipality, name } = flight.counterpart;
    if (!iata) continue;

    // Read off the local string rather than parsed: the board's own rule.
    const time = flight.scheduledLocal?.slice(11, 16) ?? '--:--';
    const existing = byCode.get(iata);

    if (!existing) {
      byCode.set(iata, { iata, name: municipality || name, count: 1, earliest: time });
      continue;
    }

    existing.count += 1;
    // Same airport on both sides, so the strings share an offset and compare.
    if (time < existing.earliest) existing.earliest = time;
  }

  return [...byCode.values()]
    .sort((a, b) => b.count - a.count || a.earliest.localeCompare(b.earliest))
    .slice(0, MAX_CARDS);
}
