import { describe, expect, it } from 'vitest';

import { arrivalOf } from './flightArrival';
import type { Flight, FlightStatus, TrackedFlight } from '../models';

const flight = (over: Partial<Flight> = {}): Flight =>
  ({
    id: 'BA 117',
    number: 'BA 117',
    airline: 'British Airways',
    direction: 'departure',
    counterpart: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
    scheduledTime: '2026-09-01T08:00:00Z',
    scheduledLocal: '2026-09-01T09:00+01:00',
    status: 'Departed',
    isCargo: false,
    isCodeshare: false,
    ...over,
  }) as Flight;

const leg = (
  departureUtc: string,
  arrivalTimes: { scheduledLocal?: string; revisedLocal?: string; predictedLocal?: string } = {},
  status: FlightStatus = 'Arrived',
): TrackedFlight =>
  ({
    id: departureUtc,
    number: 'BA 117',
    airline: 'British Airways',
    status,
    departure: {
      airport: { iata: 'LHR', name: 'Heathrow' },
      scheduledTime: departureUtc,
      scheduledLocal: '2026-09-01T09:00+01:00',
    },
    arrival: {
      airport: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
      scheduledLocal: '2026-09-01T11:30-04:00',
      ...arrivalTimes,
    },
    isCargo: false,
  }) as TrackedFlight;

describe('finding this flight among the legs of the day', () => {
  it('matches the leg leaving at the same instant', () => {
    const found = arrivalOf(flight(), [
      leg('2026-09-01T14:00:00Z'),
      leg('2026-09-01T08:00:00Z', { revisedLocal: '2026-09-01T11:52-04:00' }),
    ]);

    // A number can fly twice a day, and the other leg lands hours apart.
    expect(found?.time).toBe('11:52');
  });

  it('matches on the arrival end when the board is showing arrivals', () => {
    const arriving = flight({ direction: 'arrival', scheduledTime: '2026-09-01T15:30:00Z' });
    const inbound = leg('2026-09-01T08:00:00Z');
    inbound.arrival.scheduledTime = '2026-09-01T15:30:00Z';

    expect(arrivalOf(arriving, [inbound])).toBeTruthy();
  });

  it('takes the only leg when a number flew once and carries no time', () => {
    const found = arrivalOf(flight(), [leg(undefined as unknown as string)]);

    expect(found?.status).toBe('Arrived');
  });

  it('gives nothing rather than another leg when none matches', () => {
    // Someone else's landing beside this flight is worse than no landing.
    expect(arrivalOf(flight(), [leg('2026-09-01T14:00:00Z'), leg('2026-09-01T19:00:00Z')])).toBeNull();
  });

  it('gives nothing when the number is not flying at all', () => {
    expect(arrivalOf(flight(), [])).toBeNull();
  });
});

describe('which arrival time it reports', () => {
  const at = (times: Parameters<typeof leg>[1]) => arrivalOf(flight(), [leg('2026-09-01T08:00:00Z', times)]);

  it('prefers what the airline now says', () => {
    const found = at({ revisedLocal: '2026-09-01T11:52-04:00', predictedLocal: '2026-09-01T11:40-04:00' });

    expect(found).toMatchObject({ time: '11:52', kind: 'Revised' });
  });

  it('falls back to the prediction, and says that is what it is', () => {
    const found = at({ predictedLocal: '2026-09-01T11:40-04:00' });

    // A reader deciding when to leave for the airport needs to know which of
    // the three they are reading.
    expect(found).toMatchObject({ time: '11:40', kind: 'Predicted' });
  });

  it('falls back to the schedule', () => {
    expect(at({})).toMatchObject({ time: '11:30', kind: 'Scheduled' });
  });

  it('says it does not know rather than inventing one', () => {
    const bare = leg('2026-09-01T08:00:00Z');
    bare.arrival.scheduledLocal = undefined;

    expect(arrivalOf(flight(), [bare])).toMatchObject({ kind: 'Unknown', time: '--:--' });
  });

  it('reads the clock at the airport it lands at', () => {
    // New York local, not London's, and not the reader's.
    expect(at({ revisedLocal: '2026-09-01T11:52-04:00' })?.time).toBe('11:52');
  });

  it('carries the status of the whole journey, which the board lacks', () => {
    const found = arrivalOf(flight(), [leg('2026-09-01T08:00:00Z', {}, 'EnRoute')]);

    expect(found?.status).toBe('EnRoute');
    expect(found?.airport.iata).toBe('JFK');
  });
});
