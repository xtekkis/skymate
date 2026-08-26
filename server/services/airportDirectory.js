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
  haystack: `${entry.iata} ${entry.name} ${entry.municipality ?? ''}`.toLowerCase(),
}));

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
    .map(({ haystack, ...airport }) => airport);
}

export function airportCount() {
  return airports.length;
}
