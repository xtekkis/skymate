import { describe, expect, it } from 'vitest';

import type { FlightStatus } from '../models';
import { STATUS_LABEL, STATUS_TONE, isBoarding } from './flightStatus';

/** Every status the mapper can produce, from server/services/flightMapper.js. */
const EVERY_STATUS: FlightStatus[] = [
  'Unknown',
  'Expected',
  'CheckIn',
  'Boarding',
  'GateClosed',
  'Departed',
  'EnRoute',
  'Approaching',
  'Arrived',
  'Delayed',
  'Diverted',
  'Canceled',
];

describe('saying a status', () => {
  it('has words for every one the server can send', () => {
    // A status with no label renders as nothing at all, which on a board is
    // indistinguishable from a flight with no status.
    for (const status of EVERY_STATUS) {
      expect(STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it('spells cancelled with two Ls', () => {
    // The feed spells it the American way. The UI does not.
    expect(STATUS_LABEL.Canceled).toBe('Cancelled');
  });

  it('breaks the run-together ones into words', () => {
    expect(STATUS_LABEL.CheckIn).toBe('Check in');
    expect(STATUS_LABEL.GateClosed).toBe('Gate closed');
    expect(STATUS_LABEL.EnRoute).toBe('En route');
  });
});

describe('colouring a status', () => {
  it('has a tone for every one the server can send', () => {
    // A missing tone builds a class name ending in "undefined", which styles
    // nothing and fails silently.
    for (const status of EVERY_STATUS) {
      expect(STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('groups by what the traveller has to do about it', () => {
    // Going to plan.
    expect(STATUS_TONE.Boarding).toBe('ok');
    expect(STATUS_TONE.Approaching).toBe('ok');
    expect(STATUS_TONE.Arrived).toBe('ok');

    // Wants attention.
    expect(STATUS_TONE.GateClosed).toBe('warn');
    expect(STATUS_TONE.Delayed).toBe('warn');

    // Gone.
    expect(STATUS_TONE.Canceled).toBe('danger');

    // Over, and no longer anything to act on.
    expect(STATUS_TONE.Departed).toBe('muted');
    expect(STATUS_TONE.EnRoute).toBe('muted');
  });

  it('says nothing loudly about a status it does not recognise', () => {
    // The rule from the handoff: an unknown status is shown muted rather than
    // dropping the flight off the board.
    expect(STATUS_TONE.Unknown).toBe('muted');
  });
});

describe('the one that is happening now', () => {
  it('is boarding, and only boarding', () => {
    expect(isBoarding('Boarding')).toBe(true);

    for (const status of EVERY_STATUS.filter((s) => s !== 'Boarding')) {
      expect(isBoarding(status)).toBe(false);
    }
  });
});
