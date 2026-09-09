import { describe, expect, it } from 'vitest';

import { addHours, paramsFor, queryFrom, WINDOWS, type BoardQuery } from './searchQuery';

const query: BoardQuery = {
  airport: 'LHR',
  direction: 'departure',
  date: '2026-09-09',
  time: '08:00',
  windowHours: 4,
};

describe('adding hours to a wall clock', () => {
  it('stays on the same day when it can', () => {
    expect(addHours('2026-09-09', '08:00', 4)).toBe('2026-09-09T12:00');
  });

  it('rolls into tomorrow when it cannot', () => {
    expect(addHours('2026-09-09', '22:30', 4)).toBe('2026-09-10T02:30');
  });

  it('rolls the month and the year over too', () => {
    expect(addHours('2026-12-31', '23:00', 4)).toBe('2027-01-01T03:00');
  });

  it('ignores daylight saving entirely', () => {
    // 2026-03-29 is when the clocks go forward in Europe. These are times at
    // an airport whose zone this browser does not know, so the only correct
    // answer is plain addition: 01:30 plus four hours is 05:30, wherever the
    // reader happens to be sitting.
    expect(addHours('2026-03-29', '01:30', 4)).toBe('2026-03-29T05:30');
    expect(addHours('2026-10-25', '01:30', 4)).toBe('2026-10-25T05:30');
  });
});

describe('the window the API is given', () => {
  it('is the two timestamps around the start time', () => {
    expect(paramsFor(query)).toEqual({
      airport: 'LHR',
      direction: 'departure',
      fromLocal: '2026-09-09T08:00',
      toLocal: '2026-09-09T12:00',
    });
  });

  it('sends the airport code the way the server expects it', () => {
    expect(paramsFor({ ...query, airport: ' lhr ' }).airport).toBe('LHR');
  });
});

describe('the controls, recovered from a link', () => {
  it('is nothing when there was no link', () => {
    expect(queryFrom(null)).toBeNull();
    expect(queryFrom(undefined)).toBeNull();
  });

  it('gives back exactly what produced the window', () => {
    expect(queryFrom(paramsFor(query))).toEqual(query);
  });

  it('survives a window shared across a daylight saving change', () => {
    // Four hours over the spring forward. Measured in a browser's own zone
    // this comes back as three, matches no window we offer, and silently
    // widens to twelve.
    const spring = { ...query, date: '2026-03-29', time: '00:30' };

    expect(queryFrom(paramsFor(spring))?.windowHours).toBe(4);
  });

  it('widens to the largest window when the link asks for one we do not offer', () => {
    const odd = queryFrom({
      airport: 'LHR',
      direction: 'arrival',
      fromLocal: '2026-09-09T08:00',
      toLocal: '2026-09-09T13:00',
    });

    expect(odd?.windowHours).toBe(12);
  });

  it('never offers a window the API would refuse', () => {
    // AeroDataBox caps a query at 12 hours, so a wider one is a request spent
    // on a guaranteed error.
    for (const hours of WINDOWS) expect(hours).toBeLessThanOrEqual(12);
  });
});
