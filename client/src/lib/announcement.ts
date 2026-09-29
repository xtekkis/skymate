import type { FlightDirection } from '../models';

interface Landed {
  count: number;
  direction: FlightDirection;
  airport: string;
}

/**
 * One sentence saying where the search has got to, for a screen reader.
 *
 * The board itself is no use read aloud: it is five hundred buttons at
 * positions that mean nothing without the axis. This is what a reader gets
 * instead, so it has to carry the same three facts the card at the top of the
 * sidebar shows: how many, of what, and where.
 *
 * @param shown how many are on the board now, which differs once narrowed
 */
export function announcementFor({
  phase,
  result,
  shown,
  destination,
}: {
  phase: 'idle' | 'loading' | 'done' | 'error';
  result: Landed | null;
  shown: number;
  destination: string | null;
}) {
  if (phase === 'loading') return 'Searching flights';
  if (phase !== 'done' || !result) return '';

  if (result.count === 0) return 'No flights in that window';

  const noun = result.direction === 'departure' ? 'departures' : 'arrivals';

  return destination
    ? `${shown} of ${result.count} ${noun}, to ${destination}`
    : `${result.count} ${noun} at ${result.airport}`;
}
