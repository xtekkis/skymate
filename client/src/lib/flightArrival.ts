import type { Airport, Flight, FlightStatus, TrackedFlight } from '../models';
import { localTime } from './flightTimes';

/**
 * What a board cannot know about the far end of a flight.
 *
 * A departures board is written from the departure airport's point of view: it
 * says a flight left and stops there, because landing is the other airport's
 * business. The only way to learn that it landed is to ask about that one
 * flight, which costs one of six hundred monthly units, so it is asked for a
 * flight at a time and only when someone asks.
 */

export type ArrivalKind = 'Scheduled' | 'Revised' | 'Predicted' | 'Unknown';

export interface Arrival {
  /** The whole journey's status, which is the part a departures board lacks. */
  status: FlightStatus;
  /** Wall clock at the airport it lands at, or "--:--" when not published. */
  time: string;
  /** Which of the three times that is, since a prediction is not a schedule. */
  kind: ArrivalKind;
  airport: Airport;
}

/** The end of the journey this board is showing, which is how a leg is matched. */
function ownEnd(flight: Flight, leg: TrackedFlight) {
  return flight.direction === 'departure' ? leg.departure : leg.arrival;
}

/**
 * The arrival of the leg that matches this card.
 *
 * A number can fly more than once a day, so the leg is found by the exact
 * scheduled instant of the end this board is showing. That is a UTC timestamp
 * from the same source on both sides, so it compares directly.
 *
 * Null rather than a guess when nothing matches. Showing another leg's landing
 * beside this flight is worse than showing none.
 */
export function arrivalOf(flight: Flight, legs: TrackedFlight[]): Arrival | null {
  const leg =
    legs.find((candidate) => ownEnd(flight, candidate).scheduledTime === flight.scheduledTime) ??
    // One leg and one flight number: there is nothing it could be confused
    // with, and schedules a few days out sometimes carry no departure time.
    (legs.length === 1 ? legs[0] : undefined);

  if (!leg) return null;

  const { arrival } = leg;

  // Revised first: it is what the airline now says. A prediction is
  // AeroDataBox's own estimate and only appears close to the day.
  const [time, kind]: [string | undefined, ArrivalKind] = arrival.revisedLocal
    ? [arrival.revisedLocal, 'Revised']
    : arrival.predictedLocal
      ? [arrival.predictedLocal, 'Predicted']
      : arrival.scheduledLocal
        ? [arrival.scheduledLocal, 'Scheduled']
        : [undefined, 'Unknown'];

  return {
    status: leg.status,
    time: localTime(time),
    kind,
    airport: arrival.airport,
  };
}
