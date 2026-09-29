import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { localTime, revisedTime } from './flightTimes';

/*
 * Athens. A browser in a zone with no daylight saving would pass these either
 * way, which is exactly how a parsed wall clock survives into production.
 */
beforeAll(() => {
  vi.stubEnv('TZ', 'Europe/Athens');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('reading a wall clock', () => {
  it('reads the time the airport shows', () => {
    expect(localTime('2026-09-01T09:05+01:00')).toBe('09:05');
  });

  it('reads an hour that does not exist where the reader is', () => {
    // 03:30 on 29 March 2026 never happens in Athens: the clocks jump from
    // 03:00 to 04:00. It happens at the airport, and that is the time shown.
    expect(localTime('2026-03-29T03:30+00:00')).toBe('03:30');
  });

  it('says it does not know rather than inventing a time', () => {
    expect(localTime(undefined)).toBe('--:--');
  });
});

describe('whether a flight was revised', () => {
  const scheduledLocal = '2026-09-01T09:00+01:00';

  it('is not, when there is no revised time', () => {
    expect(revisedTime({ scheduledLocal })).toBeNull();
  });

  it('is not, when the revised time is the scheduled time', () => {
    // An on-time flight often arrives with both. Striking a time through
    // beside itself announces a delay that never happened.
    expect(revisedTime({ scheduledLocal, revisedLocal: scheduledLocal })).toBeNull();
  });

  it('is, when the time actually moved', () => {
    expect(revisedTime({ scheduledLocal, revisedLocal: '2026-09-01T09:40+01:00' })).toBe('09:40');
  });
});
