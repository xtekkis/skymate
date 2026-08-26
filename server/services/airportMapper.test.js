import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toAirport, toAirports } from './airportMapper.js';

/** Real items from /airports/search/term?q=lond, in the order the API returned them. */
const LOND = [
  { icao: 'SBLO', iata: 'LDB', name: 'Londrina Governador José Richa', municipalityName: 'Londrina', countryCode: 'BR' },
  { icao: 'AYLV', iata: 'LNV', name: 'Londolovit', municipalityName: 'Londolovit', countryCode: 'PG' },
  { icao: 'FALO', iata: 'LDZ', name: 'Londolozi', municipalityName: 'Londolozi', countryCode: 'ZA' },
  { icao: 'CYXU', iata: 'YXU', name: 'London', municipalityName: 'London', countryCode: 'CA' },
  { icao: 'EGGW', iata: 'LTN', name: 'London Luton', municipalityName: 'London', countryCode: 'GB' },
  { icao: 'EGKK', iata: 'LGW', name: 'London Gatwick', municipalityName: 'London', countryCode: 'GB' },
];

describe('toAirport', () => {
  it('maps the fields the UI labels with', () => {
    const airport = toAirport({
      icao: 'EGLL',
      iata: 'LHR',
      name: 'London Heathrow',
      shortName: 'Heathrow',
      municipalityName: 'London',
      countryCode: 'GB',
      timeZone: 'Europe/London',
    });

    assert.equal(airport.iata, 'LHR');
    assert.equal(airport.shortName, 'Heathrow');
    assert.equal(airport.municipality, 'London');
    assert.equal(airport.timeZone, 'Europe/London');
  });

  it('does not invent a name it was not given', () => {
    assert.equal(toAirport({}).name, 'Unknown airport');
    assert.equal(toAirport({}).iata, '');
  });
});

describe('toAirports', () => {
  it('puts the city someone meant above longer lookalikes', () => {
    // The upstream order is Londrina, Londolovit, Londolozi, then the Londons.
    const ranked = toAirports(LOND, 'lond');

    assert.deepEqual(
      ranked.slice(0, 3).map((airport) => airport.municipality),
      ['London', 'London', 'London'],
    );
    assert.equal(ranked.at(-1).municipality, 'Londolovit');
  });

  it('puts an exact code first, whatever else matches', () => {
    const ranked = toAirports(LOND, 'ldb');
    assert.equal(ranked[0].iata, 'LDB');
  });

  it('prefers a city match over a name match', () => {
    const items = [
      { iata: 'AAA', name: 'Yorkshire Regional', municipalityName: 'Leeds' },
      { iata: 'BBB', name: 'Something Else', municipalityName: 'York' },
    ];

    assert.equal(toAirports(items, 'york')[0].iata, 'BBB');
  });

  it('drops entries with no usable code', () => {
    const items = [
      { iata: 'LHR', name: 'London Heathrow', municipalityName: 'London' },
      { name: 'A field with a windsock', municipalityName: 'London' },
      { iata: '', name: 'Also nothing', municipalityName: 'London' },
    ];

    assert.equal(toAirports(items, 'london').length, 1);
  });

  it('returns an empty list for anything that is not a list', () => {
    for (const input of [undefined, null, {}, 'nope']) {
      assert.deepEqual(toAirports(input, 'x'), []);
    }
  });

  it('leaves order alone when there is nothing to rank by', () => {
    const ranked = toAirports(LOND, '   ');
    assert.equal(ranked[0].iata, 'LDB');
  });
});
