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

  // An exact city match and a city prefix share a tier, so runway length decides
  // between them. Otherwise "tok" surfaces Tok in Alaska ahead of Tokyo purely
  // because the small one matched exactly.
  if (municipality === query || municipality.startsWith(query)) return 1;
  if (name.startsWith(query)) return 3;
  if (municipality.includes(query)) return 4;
  if (name.includes(query)) return 5;
  return 6;
}

/**
 * Orders by how well each entry matches, then by how major the airport is,
 * then by how much extra text the match carries.
 *
 * Importance has to come before closeness. For "lo" both Lome and London are
 * prefix matches and "Lome" is the shorter word, so closeness alone puts a
 * regional airport above Heathrow. Runway length is the signal that fixes it.
 * Closeness still decides between comparably sized airports, and is the only
 * tiebreak left when scale is unknown.
 */
export function rankAirports(airports, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return airports;

  return [...airports].sort((a, b) => {
    const byRank = rank(a, needle) - rank(b, needle);
    if (byRank !== 0) return byRank;

    const byScale = (b.scale ?? 0) - (a.scale ?? 0);
    if (byScale !== 0) return byScale;

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
