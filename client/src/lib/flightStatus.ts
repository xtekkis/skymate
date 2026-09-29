import type { FlightStatus } from '../models';

/**
 * How a flight's status is said and coloured.
 *
 * Its own module because two things need it and neither owns it: the board's
 * cards and the flight table both read the same feed, and a status that is
 * amber in one place and grey in the other is worse than either choice.
 */

/** The tones a status badge may take. Colour is never the only signal. */
export type BadgeTone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

/** What a traveller sees. AeroDataBox's own spellings are not all of them. */
export const STATUS_LABEL: Record<FlightStatus, string> = {
  Unknown: 'Unknown',
  Expected: 'Expected',
  CheckIn: 'Check in',
  Boarding: 'Boarding',
  GateClosed: 'Gate closed',
  Departed: 'Departed',
  EnRoute: 'En route',
  Approaching: 'Approaching',
  Arrived: 'Arrived',
  Delayed: 'Delayed',
  Diverted: 'Diverted',
  // Two Ls in the UI. The feed spells it the American way; we do not.
  Canceled: 'Cancelled',
};

/**
 * Which tone each status takes.
 *
 * Grouped by what the traveller has to do about it rather than by where the
 * flight is: green is going to plan, amber wants attention, red has gone, and
 * grey is over and no longer actionable.
 */
export const STATUS_TONE: Record<FlightStatus, BadgeTone> = {
  Unknown: 'muted',
  Expected: 'info',
  CheckIn: 'info',
  Boarding: 'ok',
  GateClosed: 'warn',
  Departed: 'muted',
  EnRoute: 'muted',
  Approaching: 'ok',
  Arrived: 'ok',
  Delayed: 'warn',
  Diverted: 'warn',
  Canceled: 'danger',
};

/** The one status that is happening while you read it. */
export function isBoarding(status: FlightStatus) {
  return status === 'Boarding';
}
