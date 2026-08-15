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
  name: string;
  countryCode?: string;
  timeZone?: string;
}

export interface Flight {
  /** Flight number plus scheduled time — stable enough to key a list on. */
  id: string;
  /** Airline-facing number, e.g. "BA 117". */
  number: string;
  airline: string;
  direction: FlightDirection;
  /** The counterpart airport: destination for departures, origin for arrivals. */
  counterpart: Airport;
  /** ISO 8601, UTC. */
  scheduledTime: string;
  /** ISO 8601, UTC. Present once the airline revises the schedule. */
  revisedTime?: string;
  status: FlightStatus;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  /** Aircraft model, e.g. "Airbus A320 NEO". */
  aircraft?: string;
  isCargo: boolean;
  isCodeshare: boolean;
}
