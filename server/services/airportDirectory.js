import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rankAirports } from './airportMapper.js';

const dataPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/airports.json',
);

/**
 * Read once at startup. Four thousand entries is small enough to hold in memory
 * and scan directly, which is faster than any index would be and needs no
 * dependency. The haystack is precomputed so a keystroke does not lowercase
 * twelve thousand strings.
 */
const airports = JSON.parse(fs.readFileSync(dataPath, 'utf8')).map((entry) => ({
  iata: entry.iata,
  name: entry.name,
  municipality: entry.municipality,
  countryCode: entry.country,
  // Ranking input, not part of the response.
  scale: entry.scale ?? 0,
  haystack: `${entry.iata} ${entry.name} ${entry.municipality ?? ''}`.toLowerCase(),
}));

/**
 * Country by code, built once from the same list.
 *
 * The schedule sometimes arrives without a country on the far airport, and
 * every flight needs one to be grouped by country at all. This answers for
 * free: no request, no allowance, and the list is already in memory.
 */
const countries = new Map(
  airports
    .filter((airport) => airport.iata && airport.countryCode)
    .map((airport) => [airport.iata.toUpperCase(), airport.countryCode.toUpperCase()]),
);

/** The country an airport is in, or undefined for one not in the list. */
export function countryOf(iata) {
  if (!iata) return undefined;
  return countries.get(String(iata).toUpperCase());
}

export const MIN_QUERY = 2;

/**
 * Finds airports matching what was typed, best first.
 *
 * Scans everything rather than stopping early: ranking needs the whole
 * candidate set to choose well, and a full pass over 4k short strings is
 * cheaper than the network call this replaced.
 */
export function searchAirports(query, limit = 8) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle.length < MIN_QUERY) return [];

  const matches = airports.filter((airport) => airport.haystack.includes(needle));

  return rankAirports(matches, needle)
    .slice(0, limit)
    .map(({ haystack, scale, ...airport }) => airport);
}

export function airportCount() {
  return airports.length;
}
