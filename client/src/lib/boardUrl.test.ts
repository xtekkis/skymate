import { describe, expect, it } from 'vitest';

import { emptyBoard, readSearch, writeSearch } from './boardUrl';
import { todayLocal } from './boardGeometry';

const read = (query: string) => readSearch(new URLSearchParams(query));

const whole = 'airport=LHR&direction=departure&from=2026-09-01T08:00&to=2026-09-01T12:00';

describe('a search read out of the URL', () => {
  it('comes back whole when the URL is', () => {
    expect(read(whole)).toEqual({
      airport: 'LHR',
      direction: 'departure',
      fromLocal: '2026-09-01T08:00',
      toLocal: '2026-09-01T12:00',
    });
  });

  it('takes a lowercase airport as the same one', () => {
    expect(read(whole.replace('LHR', 'lhr'))?.airport).toBe('LHR');
  });

  it('is nothing at all when a piece is missing', () => {
    // A half written URL should show the empty board, not an error.
    expect(read('airport=LHR')).toBeNull();
    expect(read('from=2026-09-01T08:00&to=2026-09-01T12:00')).toBeNull();
    expect(read('')).toBeNull();
  });

  it('is nothing when a piece is the wrong shape', () => {
    // These are the shapes the server refuses, so they must not be sent.
    expect(read(whole.replace('LHR', 'LONDON'))).toBeNull();
    expect(read(whole.replace('2026-09-01T08:00', 'tomorrow'))).toBeNull();
    expect(read(whole.replace('2026-09-01T12:00', '2026-09-01'))).toBeNull();
  });

  it('reads anything that is not an arrival as a departure', () => {
    expect(read(whole.replace('departure', 'arrival'))?.direction).toBe('arrival');
    expect(read(whole.replace('departure', 'nonsense'))?.direction).toBe('departure');
  });
});

describe('a search written back into the URL', () => {
  it('survives the round trip unchanged', () => {
    const search = read(whole)!;

    // The two shapes are different, and drift between them is a board that
    // cannot restore the search that made it.
    expect(readSearch(new URLSearchParams(writeSearch(search)))).toEqual(search);
  });
});

describe('the board before anyone has searched', () => {
  it('has a real day and hour to draw a ruler from', () => {
    const empty = emptyBoard();

    expect(empty.date).toBe(todayLocal());
    expect(empty.time).toBe('08:00');
    expect(empty.windowHours).toBe(12);
  });

  it('has no airport, which is what stops it costing anything', () => {
    // The search hook refuses a window with no airport, so an unsearched
    // board spends none of the monthly allowance.
    expect(emptyBoard().airport).toBe('');
  });
});
