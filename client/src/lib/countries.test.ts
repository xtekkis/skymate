import { describe, expect, it } from 'vitest';

import { busiestCountry, countryName, inCountry, toCountries, UNKNOWN } from './countries';
import type { Flight } from '../models';

const to = (iata: string, country?: string): Flight =>
  ({
    id: `${iata}-${Math.random()}`,
    number: 'BA 1',
    airline: 'British Airways',
    direction: 'departure',
    counterpart: { iata, name: iata, municipality: iata, countryCode: country },
    scheduledTime: '2026-09-01T08:00:00Z',
    scheduledLocal: '2026-09-01T09:00+01:00',
    status: 'Expected',
    isCargo: false,
    isCodeshare: false,
  }) as Flight;

const board = [
  to('JFK', 'US'),
  to('LAX', 'US'),
  to('ORD', 'US'),
  to('CDG', 'FR'),
  to('NCE', 'FR'),
  to('MAD', 'ES'),
];

describe('naming a country', () => {
  it('says it in words rather than in code', () => {
    expect(countryName('US')).toBe('United States');
    expect(countryName('PT')).toBe('Portugal');
  });

  it('falls back to the code rather than throwing on a bad one', () => {
    // One unrecognised code on one flight must not empty the picker.
    expect(countryName('QQ')).toBe('QQ');
    expect(countryName('not a country')).toBe('not a country');
  });

  it('has a word for the flights with no country at all', () => {
    expect(countryName(UNKNOWN)).toBe('Unknown');
  });
});

describe('where the board goes, by country', () => {
  it('counts the flights to each', () => {
    expect(toCountries(board)).toEqual([
      { code: 'US', name: 'United States', count: 3 },
      { code: 'FR', name: 'France', count: 2 },
      { code: 'ES', name: 'Spain', count: 1 },
    ]);
  });

  it('is nothing at all for an empty board', () => {
    expect(toCountries([])).toEqual([]);
  });

  it('reads a lowercase code as the same country', () => {
    // The schedule sends lowercase. Two groups for one country would split
    // its flights across two entries nobody can see at once.
    expect(toCountries([to('LIS', 'pt'), to('OPO', 'PT')])).toEqual([
      { code: 'PT', name: 'Portugal', count: 2 },
    ]);
  });

  it('orders countries with the same count by name', () => {
    const groups = toCountries([to('CDG', 'FR'), to('MAD', 'ES')]);

    // By the name the picker shows, not the code behind it, and stable so
    // it does not reshuffle between two identical searches.
    expect(groups.map((group) => group.name)).toEqual(['France', 'Spain']);
  });

  it('keeps the flights with no country instead of losing them', () => {
    const groups = toCountries([to('JFK', 'US'), to('ZZZ')]);

    // Only one country shows at a time, so a dropped flight is a flight
    // nobody can reach.
    expect(groups).toContainEqual({ code: UNKNOWN, name: 'Unknown', count: 1 });
  });

  it('puts those last however many there are', () => {
    const groups = toCountries([to('ZZZ'), to('YYY'), to('XXX'), to('JFK', 'US')]);

    // A gap in the data is not a destination, and must never be what a
    // search opens on.
    expect(groups.at(-1)?.code).toBe(UNKNOWN);
  });
});

describe('the country a search opens on', () => {
  it('is the one with the most flights', () => {
    expect(busiestCountry(board)).toBe('US');
  });

  it('is nothing when there is nothing to show', () => {
    expect(busiestCountry([])).toBeNull();
  });

  it('is never the flights with no country while any country has some', () => {
    expect(busiestCountry([to('ZZZ'), to('YYY'), to('YYY'), to('JFK', 'US')])).toBe('US');
  });
});

describe('narrowing the board to one country', () => {
  it('keeps only the flights going there', () => {
    expect(inCountry(board, 'FR')).toHaveLength(2);
  });

  it('matches a lowercase code too', () => {
    expect(inCountry([to('LIS', 'pt')], 'PT')).toHaveLength(1);
  });

  it('keeps everything when no country is chosen', () => {
    expect(inCountry(board, null)).toHaveLength(board.length);
  });

  it('finds the ones with no country', () => {
    expect(inCountry([to('JFK', 'US'), to('ZZZ')], UNKNOWN)).toHaveLength(1);
  });
});
