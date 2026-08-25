/** Whether a flight is leaving the searched airport or landing at it. */
export type FlightDirection = 'departure' | 'arrival';

/** Lifecycle states AeroDataBox reports for a movement. */
export type FlightStatus =
  | 'Unknown'
  | 'Expected'
  | 'CheckIn'
  | 'Boarding'
  | 'GateClosed'
  | 'Departed'
  | 'EnRoute'
  | 'Approaching'
  | 'Arrived'
  | 'Delayed'
  | 'Diverted'
  | 'Canceled';

export interface Airport {
  iata: string;
  icao?: string;
  /** Full name, e.g. "London Heathrow". */
  name: string;
  /** Just the airport, e.g. "Heathrow". */
  shortName?: string;
  /** The city it serves, e.g. "London". */
  municipality?: string;
  countryCode?: string;
  timeZone?: string;
}

export interface Flight {
  /** Flight number plus scheduled time, stable enough to key a list on. */
  id: string;
  /** Airline-facing number, e.g. "BA 117". */
  number: string;
  airline: string;
  direction: FlightDirection;
  /** The counterpart airport: destination for departures, origin for arrivals. */
  counterpart: Airport;
  /** ISO 8601, UTC. Use for sorting and comparison. */
  scheduledTime: string;
  /**
   * ISO 8601 carrying the airport's own offset, e.g. "2026-08-16T08:00+01:00".
   * Use for display so times read the way the terminal board does.
   */
  scheduledLocal?: string;
  /** ISO 8601, UTC. Present once the airline revises the schedule. */
  revisedTime?: string;
  /** Revised time in the airport's local offset. */
  revisedLocal?: string;
  status: FlightStatus;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  /** Aircraft model, e.g. "Airbus A320 NEO". */
  aircraft?: string;
  isCargo: boolean;
  isCodeshare: boolean;
  /** True when the aircraft is genuinely being tracked, not just scheduled. */
  isLive?: boolean;
}

/**
 * One end of a tracked flight.
 *
 * Every field beyond the airport is optional on purpose. AeroDataBox fills
 * detail in as the day approaches, so a flight several days out often has only
 * an airport name on the arrival side. Rendering must handle that rather than
 * showing a row of blanks.
 */
export interface FlightEndpoint {
  airport: Airport;
  /** ISO 8601, UTC. Use for sorting and comparison. */
  scheduledTime?: string;
  /** ISO 8601 with the airport's own offset. Use for display. */
  scheduledLocal?: string;
  revisedTime?: string;
  revisedLocal?: string;
  /** A prediction rather than a published time. Appears close to the day. */
  predictedTime?: string;
  predictedLocal?: string;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  baggageBelt?: string;
  /** True when the aircraft is genuinely being tracked, not just scheduled. */
  isLive?: boolean;
}

/**
 * A flight looked up by its number, which names both ends of the journey.
 * Distinct from Flight, which is one movement on a single airport's board and
 * names only the counterpart.
 */
export interface TrackedFlight {
  id: string;
  /** Airline-facing number, e.g. "BA 117". */
  number: string;
  airline: string;
  status: FlightStatus;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  aircraft?: string;
  isCargo: boolean;
  /** ISO 8601, UTC. When AeroDataBox last refreshed this leg. */
  lastUpdated?: string;
}
