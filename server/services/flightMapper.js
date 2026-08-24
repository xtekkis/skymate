/**
 * Turns raw AeroDataBox movement objects into the Flight shape the client
 * models. Upstream fields are frequently absent, so every optional value is
 * treated as missing rather than assumed present.
 */

/** AeroDataBox statuses, narrowed onto the set the client models. */
const STATUS_MAP = {
  Unknown: 'Unknown',
  Expected: 'Expected',
  CheckIn: 'CheckIn',
  Boarding: 'Boarding',
  GateClosed: 'GateClosed',
  Departed: 'Departed',
  EnRoute: 'EnRoute',
  Approaching: 'Approaching',
  Arrived: 'Arrived',
  Delayed: 'Delayed',
  Diverted: 'Diverted',
  Canceled: 'Canceled',
  CanceledUncertain: 'Canceled',
};

/**
 * AeroDataBox emits "2026-08-16 07:00Z": a space instead of T, and no seconds.
 * Parsing and re-emitting gives real ISO 8601 and rejects anything unparseable.
 */
function toIso(stamp) {
  if (!stamp?.utc) return undefined;
  const parsed = new Date(String(stamp.utc).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Keeps the airport's own wall-clock time and offset ("2026-08-16T08:00+01:00")
 * rather than converting. A board has to read the way the terminal screen does,
 * which is neither UTC nor whatever timezone the browser happens to be in.
 */
function toLocalIso(stamp) {
  if (!stamp?.local) return undefined;
  const normalized = String(stamp.local).replace(' ', 'T');
  return Number.isNaN(new Date(normalized).getTime()) ? undefined : normalized;
}

function toAirport(raw) {
  return {
    iata: raw?.iata ?? '',
    icao: raw?.icao,
    name: raw?.name ?? 'Unknown airport',
    countryCode: raw?.countryCode,
    timeZone: raw?.timeZone,
  };
}

function toStatus(value) {
  return STATUS_MAP[value] ?? 'Unknown';
}

export function toFlight(raw, direction) {
  const scheduledTime = toIso(raw?.movement?.scheduledTime);
  const number = String(raw?.number ?? '').trim();

  return {
    id: `${number || 'unknown'}@${scheduledTime ?? 'unscheduled'}`,
    number,
    airline: raw?.airline?.name ?? 'Unknown airline',
    direction,
    counterpart: toAirport(raw?.movement?.airport),
    scheduledTime,
    scheduledLocal: toLocalIso(raw?.movement?.scheduledTime),
    revisedTime: toIso(raw?.movement?.revisedTime),
    revisedLocal: toLocalIso(raw?.movement?.revisedTime),
    status: toStatus(raw?.status),
    terminal: raw?.movement?.terminal,
    gate: raw?.movement?.gate,
    checkInDesk: raw?.movement?.checkInDesk,
    aircraft: raw?.aircraft?.model,
    isCargo: Boolean(raw?.isCargo),
    isCodeshare: raw?.codeshareStatus === 'IsCodeshared',
  };
}

/**
 * Maps a whole response, dropping movements with no usable scheduled time
 * (they cannot be placed on a board) and ordering by that time.
 */
export function toFlights(rows, direction) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => toFlight(row, direction))
    .filter((flight) => Boolean(flight.scheduledTime))
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

/**
 * One end of a tracked flight.
 *
 * Either end can be sparse. AeroDataBox fills detail in as the day approaches,
 * so a flight several days out often carries only an airport name on the
 * arrival side, with no code, no terminal and no times. Every field here is
 * therefore optional, and callers must not assume the two ends match.
 */
function toEndpoint(raw) {
  return {
    airport: toAirport(raw?.airport),
    scheduledTime: toIso(raw?.scheduledTime),
    scheduledLocal: toLocalIso(raw?.scheduledTime),
    revisedTime: toIso(raw?.revisedTime),
    revisedLocal: toLocalIso(raw?.revisedTime),
    terminal: raw?.terminal,
    gate: raw?.gate,
    checkInDesk: raw?.checkInDesk,
    baggageBelt: raw?.baggageBelt,
  };
}

/** Maps one leg from the flight-number endpoint, which is shaped differently
 * from an airport board: it names both ends rather than one counterpart. */
export function toTrackedFlight(raw) {
  const departure = toEndpoint(raw?.departure);
  const number = String(raw?.number ?? '').trim();

  return {
    id: `${number || 'unknown'}@${departure.scheduledTime ?? 'unscheduled'}`,
    number,
    airline: raw?.airline?.name ?? 'Unknown airline',
    status: toStatus(raw?.status),
    departure,
    arrival: toEndpoint(raw?.arrival),
    aircraft: raw?.aircraft?.model,
    isCargo: Boolean(raw?.isCargo),
    lastUpdated: toIso({ utc: raw?.lastUpdatedUtc }),
  };
}

/**
 * Maps every leg flying under a number, dropping any with no departure time.
 * A leg we cannot place in time tells the user nothing useful.
 */
export function toTrackedFlights(legs) {
  return (Array.isArray(legs) ? legs : [])
    .map((leg) => toTrackedFlight(leg))
    .filter((flight) => Boolean(flight.departure.scheduledTime))
    .sort((a, b) => a.departure.scheduledTime.localeCompare(b.departure.scheduledTime));
}
