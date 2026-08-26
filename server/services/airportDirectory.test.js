import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { airportCount, MIN_QUERY, searchAirports } from './airportDirectory.js';

describe('airport directory', () => {
  it('loaded the bundled data', () => {
    assert.ok(airportCount() > 3000, `expected thousands of airports, got ${airportCount()}`);
  });

  it('ignores a query too short to be useful', () => {
    assert.deepEqual(searchAirports('l'), []);
    assert.deepEqual(searchAirports(''), []);
    assert.deepEqual(searchAirports('   '), []);
  });

  it('finds an airport by its code', () => {
    const [first] = searchAirports('LHR');
    assert.equal(first.iata, 'LHR');
    assert.match(first.name, /Heathrow/);
  });

  it('is case insensitive', () => {
    assert.equal(searchAirports('lhr')[0].iata, 'LHR');
    assert.equal(searchAirports('LhR')[0].iata, 'LHR');
  });

  it('finds airports by city', () => {
    const codes = searchAirports('london', 8).map((airport) => airport.iata);
    assert.ok(codes.includes('LHR'), `expected LHR among ${codes.join(', ')}`);
    assert.ok(codes.includes('LGW'), `expected LGW among ${codes.join(', ')}`);
  });

  it('puts the city someone meant ahead of longer lookalikes', () => {
    // This is the case the upstream API got wrong: Londrina before London.
    const cities = searchAirports('lond', 5).map((airport) => airport.municipality);
    assert.equal(cities[0], 'London');
  });

  it('finds an airport by name when the city differs', () => {
    const codes = searchAirports('heathrow').map((airport) => airport.iata);
    assert.deepEqual(codes, ['LHR']);
  });

  it('respects the limit', () => {
    assert.equal(searchAirports('a', 5).length, 0, 'still too short');
    assert.ok(searchAirports('air', 3).length <= 3);
  });

  it('does not leak the internal search field', () => {
    const [first] = searchAirports('LHR');
    assert.equal(first.haystack, undefined);
    assert.deepEqual(Object.keys(first).sort(), ['countryCode', 'iata', 'municipality', 'name']);
  });

  it('returns nothing for a query that matches nothing', () => {
    assert.deepEqual(searchAirports('zzzzzzzz'), []);
  });

  it('exposes the minimum so the client can agree with it', () => {
    assert.equal(MIN_QUERY, 2);
  });
});
