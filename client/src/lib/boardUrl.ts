import { todayLocal } from './boardGeometry';
import type { BoardQuery } from './searchQuery';

import type { SearchParams } from '../models';

/**
 * The search, as it lives in the query string.
 *
 * It lives there rather than in component state because that is what makes
 * going back from a flight restore the board instead of an empty one, and it
 * survives a refresh and makes a search shareable, which memory alone cannot
 * do. Both directions are here so the two shapes cannot drift apart.
 */

/** Reads a window out of the URL, or nothing if it is not a whole one. */
export function readSearch(params: URLSearchParams): SearchParams | null {
  const airport = (params.get('airport') ?? '').toUpperCase();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const direction = params.get('direction') === 'arrival' ? 'arrival' : 'departure';

  // A half written URL should show the empty board, not an error.
  if (!/^[A-Z]{3}$/.test(airport)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(to)) return null;

  return { airport, direction, fromLocal: from, toLocal: to };
}

/** And writes one back, which is how a search is started at all. */
export function writeSearch(search: SearchParams) {
  return {
    airport: search.airport,
    direction: search.direction,
    from: search.fromLocal,
    to: search.toLocal,
  };
}

/**
 * What the board shows before anyone has searched.
 *
 * A real date and time, so the ruler has hours on it and the axis is something
 * to look at rather than a blank rectangle. The airport is empty on purpose:
 * that is the field the search hook refuses, so an unsearched board costs
 * nothing.
 */
export function emptyBoard(): BoardQuery {
  return { airport: '', direction: 'departure', date: todayLocal(), time: '08:00', windowHours: 12 };
}
