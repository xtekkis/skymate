import { describe, expect, it } from 'vitest';

import { announcementFor } from './announcement';

const landed = { count: 20, direction: 'departure' as const, airport: 'LHR' };

const say = (over: Partial<Parameters<typeof announcementFor>[0]> = {}) =>
  announcementFor({ phase: 'done', result: landed, shown: 20, destination: null, ...over });

describe('what a screen reader is told', () => {
  it('says how many, of what, and where', () => {
    expect(say()).toBe('20 departures at LHR');
  });

  it('names arrivals as arrivals', () => {
    expect(say({ result: { ...landed, direction: 'arrival' } })).toBe('20 arrivals at LHR');
  });

  it('says how much of the window is on screen once narrowed', () => {
    expect(say({ shown: 2, destination: 'JFK' })).toBe('2 of 20 departures, to JFK');
  });

  it('says a search is running', () => {
    expect(say({ phase: 'loading' })).toBe('Searching flights');
  });

  it('says when a window came back empty', () => {
    expect(say({ result: { ...landed, count: 0 } })).toBe('No flights in that window');
  });

  it('says nothing before anything has been asked for', () => {
    expect(say({ phase: 'idle', result: null })).toBe('');
  });

  it('says nothing about a failure, which is an alert rather than a status', () => {
    expect(say({ phase: 'error', result: null })).toBe('');
  });
});
