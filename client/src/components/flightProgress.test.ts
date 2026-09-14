import { describe, expect, it } from 'vitest';

import { progressOf, type Step } from './flightProgress';
import type { Flight, FlightDirection, FlightStatus } from '../models';

const ALL: FlightStatus[] = [
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

const DIRECTIONS: FlightDirection[] = ['departure', 'arrival'];

const flight = (status: FlightStatus, direction: FlightDirection = 'departure', extra: Partial<Flight> = {}): Flight => ({
  id: 'x',
  number: 'BA 117',
  airline: 'British Airways',
  direction,
  counterpart: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-01T08:00:00Z',
  scheduledLocal: '2026-09-01T09:00+01:00',
  status,
  isCargo: false,
  isCodeshare: false,
  ...extra,
});

function steps(status: FlightStatus, direction: FlightDirection = 'departure', extra: Partial<Flight> = {}): Step[] {
  const progress = progressOf(flight(status, direction, extra));
  if (progress.kind !== 'steps') throw new Error(`${status} stopped rather than stepping`);
  return progress.steps;
}

const reached = (list: Step[]) => list.filter((step) => step.reached).map((step) => step.label);

describe('the rule this section exists to keep', () => {
  it('never puts a time beside anything but the last stage, for any status either way', () => {
    // No source publishes when check in opens, when boarding starts or when
    // the gate closes. A time beside one of those would be invented.
    for (const direction of DIRECTIONS) {
      for (const status of ALL) {
        const progress = progressOf(flight(status, direction));
        if (progress.kind !== 'steps') continue;

        const early = progress.steps.slice(0, -1);
        for (const step of early) expect(step.time, `${direction} ${status} ${step.label}`).toBeUndefined();
      }
    }
  });

  it('always has a time on the last stage, since the schedule always carries one', () => {
    for (const direction of DIRECTIONS) {
      for (const status of ALL) {
        const progress = progressOf(flight(status, direction));
        if (progress.kind !== 'steps') continue;

        expect(progress.steps.at(-1)?.time, `${direction} ${status}`).toBeTruthy();
      }
    }
  });

  it('never lights a stage beyond one that is still unlit', () => {
    // A dot out of order reads as the flight having skipped something.
    for (const direction of DIRECTIONS) {
      for (const status of ALL) {
        const progress = progressOf(flight(status, direction));
        if (progress.kind !== 'steps') continue;

        const lit = progress.steps.map((step) => step.reached);
        const firstUnlit = lit.indexOf(false);
        if (firstUnlit !== -1) expect(lit.slice(firstUnlit).includes(true), `${direction} ${status}`).toBe(false);
      }
    }
  });

  it('points at the furthest stage reached, or at nothing', () => {
    for (const direction of DIRECTIONS) {
      for (const status of ALL) {
        const progress = progressOf(flight(status, direction));
        if (progress.kind !== 'steps') continue;

        expect(progress.current, `${direction} ${status}`).toBe(reached(progress.steps).length - 1);
      }
    }
  });
});

describe('a departure', () => {
  it('has lit nothing before check in opens', () => {
    for (const status of ['Unknown', 'Expected'] as FlightStatus[]) {
      expect(reached(steps(status))).toEqual([]);
    }
  });

  it('counts a delay as not gone yet, without guessing which stage it is stuck at', () => {
    expect(reached(steps('Delayed'))).toEqual([]);
  });

  it('lights each stage as the status reaches it', () => {
    expect(reached(steps('CheckIn'))).toEqual(['Check in']);
    expect(reached(steps('Boarding'))).toEqual(['Check in', 'Boarding']);
    expect(reached(steps('GateClosed'))).toEqual(['Check in', 'Boarding', 'Gate closed']);
  });

  it('counts anything past the gate as departed, since it has necessarily left', () => {
    for (const status of ['Departed', 'EnRoute', 'Approaching', 'Arrived'] as FlightStatus[]) {
      expect(steps(status).every((step) => step.reached), status).toBe(true);
    }
  });

  it('says Departure until it has gone and Departed once it has', () => {
    // "Departed 09:00" on a flight still at the gate would be the one false
    // sentence in the section.
    expect(steps('Boarding').at(-1)?.label).toBe('Departure');
    expect(steps('Departed').at(-1)?.label).toBe('Departed');
  });
});

describe('an arrival', () => {
  it('shows the journey rather than stages at the other airport', () => {
    expect(steps('Expected', 'arrival').map((step) => step.label)).toEqual([
      'Departure',
      'En route',
      'Approaching',
      'Arrival',
    ]);
  });

  it('does not light anything for check in or boarding at the other end', () => {
    for (const status of ['CheckIn', 'Boarding', 'GateClosed'] as FlightStatus[]) {
      expect(reached(steps(status, 'arrival')), status).toEqual([]);
    }
  });

  it('lights the journey as it happens', () => {
    expect(reached(steps('Departed', 'arrival'))).toEqual(['Departed']);
    expect(reached(steps('EnRoute', 'arrival'))).toEqual(['Departed', 'En route']);
    expect(reached(steps('Approaching', 'arrival'))).toEqual(['Departed', 'En route', 'Approaching']);
  });

  it('says Arrived only once it has', () => {
    expect(steps('Approaching', 'arrival').at(-1)?.label).toBe('Arrival');
    expect(steps('Arrived', 'arrival').at(-1)?.label).toBe('Arrived');
  });
});

describe('the one time it does show', () => {
  it('is the scheduled time off the airport clock', () => {
    expect(steps('Expected').at(-1)?.time).toEqual({ scheduled: '09:00', revised: null });
  });

  it('carries a revision when the time really moved', () => {
    const last = steps('Expected', 'departure', { revisedLocal: '2026-09-01T09:40+01:00' }).at(-1);

    expect(last?.time).toEqual({ scheduled: '09:00', revised: '09:40' });
  });

  it('does not carry one that is the scheduled time again', () => {
    const last = steps('Expected', 'departure', { revisedLocal: '2026-09-01T09:00+01:00' }).at(-1);

    expect(last?.time?.revised).toBeNull();
  });
});

describe('a flight that is not going to finish', () => {
  it('says it is cancelled outright rather than showing stages it will never reach', () => {
    for (const direction of DIRECTIONS) {
      expect(progressOf(flight('Canceled', direction))).toEqual({
        kind: 'stopped',
        label: 'Cancelled',
        tone: 'danger',
      });
    }
  });

  it('says it was diverted', () => {
    for (const direction of DIRECTIONS) {
      expect(progressOf(flight('Diverted', direction))).toEqual({
        kind: 'stopped',
        label: 'Diverted',
        tone: 'warn',
      });
    }
  });
});
