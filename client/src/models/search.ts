import type { FlightDirection } from './flight';

export interface SearchParams {
  /** IATA code of the airport to inspect, e.g. "LHR". */
  airport: string;
  direction: FlightDirection;
  /** Local datetime at the airport, ISO 8601 without zone: "2026-08-16T08:00". */
  fromLocal: string;
  /** Local datetime at the airport. AeroDataBox caps the window at 12 hours. */
  toLocal: string;
}
