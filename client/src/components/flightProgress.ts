import type { Flight, FlightStatus } from '../models';
import { localTime, revisedTime } from './flightTimes';

/**
 * Where a flight has got to, told only from what AeroDataBox actually says.
 *
 * Kept apart from the panel so every status can be tested without a render,
 * and because this is the part that must not lie. The design this comes from
 * put times beside check in, boarding and gate closing, worked out as fixed
 * offsets from departure. No source publishes those times, so these stages
 * carry none. The status says a stage has been reached; it never says when.
 */

export interface Step {
  label: string;
  reached: boolean;
  /**
   * Only the last stage has one, since departure and arrival are the only
   * times the schedule carries. Revised is null unless the time really moved.
   */
  time?: { scheduled: string; revised: string | null };
}

export type Progress =
  | { kind: 'steps'; steps: Step[]; /** The furthest stage reached, or -1. */ current: number }
  /** A flight that is not going to reach the end, which a row of unlit dots would hide. */
  | { kind: 'stopped'; label: string; tone: 'danger' | 'warn' };

/*
 * How far each status is along a departure. Anything past the gate counts as
 * departed: a flight that is en route has, necessarily, left.
 *
 * Delayed, Expected and Unknown sit at zero. A delay says the flight has not
 * gone yet, and nothing about which stage it is waiting at.
 */
const DEPARTURE_STAGE: Partial<Record<FlightStatus, number>> = {
  CheckIn: 1,
  Boarding: 2,
  GateClosed: 3,
  Departed: 4,
  EnRoute: 4,
  Approaching: 4,
  Arrived: 4,
};

/*
 * And along an arrival. Check in and boarding happened at the other airport
 * and are not this board's to show, so an arrival's stages are the journey:
 * it left, it is flying, it is close, it is here.
 */
const ARRIVAL_STAGE: Partial<Record<FlightStatus, number>> = {
  Departed: 1,
  EnRoute: 2,
  Approaching: 3,
  Arrived: 4,
};

export function progressOf(flight: Flight): Progress {
  if (flight.status === 'Canceled') return { kind: 'stopped', label: 'Cancelled', tone: 'danger' };
  if (flight.status === 'Diverted') return { kind: 'stopped', label: 'Diverted', tone: 'warn' };

  const outbound = flight.direction === 'departure';
  const stage = (outbound ? DEPARTURE_STAGE : ARRIVAL_STAGE)[flight.status] ?? 0;

  const time = {
    scheduled: localTime(flight.scheduledLocal),
    revised: revisedTime(flight),
  };

  /*
   * The last stage changes tense once it is reached. "Departed 09:40" on a
   * flight still at the gate would be the one false sentence in the section.
   */
  const labels = outbound
    ? ['Check in', 'Boarding', 'Gate closed', stage >= 4 ? 'Departed' : 'Departure']
    : [stage >= 1 ? 'Departed' : 'Departure', 'En route', 'Approaching', stage >= 4 ? 'Arrived' : 'Arrival'];

  const steps: Step[] = labels.map((label, index) => ({
    label,
    reached: stage >= index + 1,
    ...(index === labels.length - 1 ? { time } : {}),
  }));

  return { kind: 'steps', steps, current: stage - 1 };
}
