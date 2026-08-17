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
    revisedTime: toIso(raw?.movement?.revisedTime),
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
