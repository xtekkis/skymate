import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countryOf, airportCount, MIN_QUERY, searchAirports } from './airportDirectory.js';

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

  it('surfaces major airports for a short query, not regional lookalikes', () => {
    // 'lo' matches Lome, Lopez Island and Lolak as well as London and Los
    // Angeles. Runway length is what separates them.
    const top = searchAirports('lo', 5).map((airport) => airport.iata);
    assert.ok(top.includes('LHR') || top.includes('LAX'), `expected a major airport in ${top.join(', ')}`);
    assert.ok(!top.includes('LPS'), 'Lopez Island should not outrank a hub');
  });

  it('prefers the bigger airport when a small city matches exactly', () => {
    // Tok, Alaska is an exact match for 'tok'. Tokyo is what people mean.
    assert.equal(searchAirports('tok', 3)[0].municipality, 'Tokyo');
  });

  it('orders the London airports by size', () => {
    const london = searchAirports('london', 3).map((airport) => airport.iata);
    assert.equal(london[0], 'LHR', `expected Heathrow first, got ${london.join(', ')}`);
  });
  it('returns nothing for a query that matches nothing', () => {
    assert.deepEqual(searchAirports('zzzzzzzz'), []);
  });

  it('exposes the minimum so the client can agree with it', () => {
    assert.equal(MIN_QUERY, 2);
  });
});

describe('the country an airport is in', () => {
  it('answers from the list already in memory', () => {
    // No request and no allowance spent: the schedule leaves this out often
    // enough that asking upstream for it would be most of a month's units.
    assert.equal(countryOf('LHR'), 'GB');
    assert.equal(countryOf('JFK'), 'US');
  });

  it('takes a code in any case and gives one back in upper', () => {
    // The schedule sends lowercase, and no region lookup accepts that.
    assert.equal(countryOf('lis'), 'PT');
  });

  it('says nothing for an airport it does not carry', () => {
    // Four thousand airports is not all of them, and a guess here would put
    // a flight under the wrong country.
    assert.equal(countryOf('ZZZ'), undefined);
    assert.equal(countryOf(''), undefined);
    assert.equal(countryOf(undefined), undefined);
  });
});
