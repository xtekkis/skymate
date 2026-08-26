/**
 * Airports, and how to order them for someone typing.
 *
 * toAirport lives here rather than in flightMapper because both the flight
 * mappers and airport search need it, and two copies is how one of them
 * eventually drifts.
 */

export function toAirport(raw) {
  return {
    iata: raw?.iata ?? '',
    icao: raw?.icao,
    name: raw?.name ?? 'Unknown airport',
    // "Heathrow" and "London" read better together than "London Heathrow".
    shortName: raw?.shortName,
    municipality: raw?.municipalityName,
    countryCode: raw?.countryCode,
    timeZone: raw?.timeZone,
  };
}

/**
 * How well an airport answers what was typed. Lower is better.
 *
 * The upstream search does not rank usefully: "lond" comes back with Londrina
 * and Londolovit ahead of London Gatwick. People type the city they mean, so
 * a city match beats a name match, and an exact code beats everything.
 */
function rank(airport, query) {
  const iata = airport.iata.toLowerCase();
  const municipality = (airport.municipality ?? '').toLowerCase();
  const name = airport.name.toLowerCase();

  if (iata === query) return 0;
  if (municipality === query) return 1;
  if (municipality.startsWith(query)) return 2;
  if (name.startsWith(query)) return 3;
  if (municipality.includes(query)) return 4;
  if (name.includes(query)) return 5;
  return 6;
}

/**
 * Orders by how well each entry matches, then by how much extra text the match
 * carries. That second part is what puts London ahead of Londrina: both start
 * with "lond", but "London" has less left over.
 */
export function rankAirports(airports, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return airports;

  return [...airports].sort((a, b) => {
    const byRank = rank(a, needle) - rank(b, needle);
    if (byRank !== 0) return byRank;

    const byCity = (a.municipality ?? '').length - (b.municipality ?? '').length;
    if (byCity !== 0) return byCity;

    return a.name.length - b.name.length;
  });
}

/** Maps and orders a whole search response. */
export function toAirports(items, query) {
  const mapped = (Array.isArray(items) ? items : [])
    .map((item) => toAirport(item))
    // An airport with no IATA code cannot be searched on, so it is noise here.
    .filter((airport) => airport.iata.length === 3);

  return rankAirports(mapped, query);
}
