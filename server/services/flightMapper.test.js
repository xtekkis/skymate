import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toFlight, toFlights } from './flightMapper.js';

/**
 * Fixtures copied from real AeroDataBox responses, so the shapes here are what
 * the API actually sends rather than what it might be assumed to send.
 */
function movement({ utc = '2026-08-19 07:00Z', local = '2026-08-19T08:00+01:00', ...rest } = {}) {
  return {
    airport: { icao: 'LPPT', iata: 'LIS', name: 'Lisbon', countryCode: 'pt', timeZone: 'Europe/Lisbon' },
    scheduledTime: { utc, local },
    ...rest,
  };
}

function row(overrides = {}) {
  return {
    movement: movement(),
    number: 'TP 1351',
    status: 'Expected',
    codeshareStatus: 'IsOperator',
    isCargo: false,
    aircraft: { model: 'Airbus A320 NEO' },
    airline: { name: 'TAP Air Portugal', iata: 'TP', icao: 'TAP' },
    ...overrides,
  };
}

describe('toFlight', () => {
  it('maps a complete movement', () => {
    const flight = toFlight(row(), 'departure');

    assert.equal(flight.number, 'TP 1351');
    assert.equal(flight.airline, 'TAP Air Portugal');
    assert.equal(flight.direction, 'departure');
    assert.equal(flight.counterpart.iata, 'LIS');
    assert.equal(flight.counterpart.timeZone, 'Europe/Lisbon');
    assert.equal(flight.aircraft, 'Airbus A320 NEO');
    assert.equal(flight.isCargo, false);
  });

  it('normalises the upstream timestamp into real ISO 8601', () => {
    // AeroDataBox sends "2026-08-19 07:00Z": a space instead of T, no seconds.
    const flight = toFlight(row(), 'departure');
    assert.equal(flight.scheduledTime, '2026-08-19T07:00:00.000Z');
  });

  it('keeps the airport local time verbatim, offset and all', () => {
    // Parsing and reformatting this would re-render it in the server's timezone,
    // which is the bug scheduledLocal exists to prevent.
    const flight = toFlight(row(), 'departure');
    assert.equal(flight.scheduledLocal, '2026-08-19T08:00+01:00');
  });

  it('rejects an unparseable timestamp instead of emitting Invalid Date', () => {
    const flight = toFlight(row({ movement: movement({ utc: 'not a date' }) }), 'departure');
    assert.equal(flight.scheduledTime, undefined);
  });

  it('folds CanceledUncertain into Canceled', () => {
    assert.equal(toFlight(row({ status: 'CanceledUncertain' }), 'departure').status, 'Canceled');
  });

  it('falls back to Unknown for a status the client does not model', () => {
    assert.equal(toFlight(row({ status: 'SomethingNew' }), 'departure').status, 'Unknown');
    assert.equal(toFlight(row({ status: undefined }), 'departure').status, 'Unknown');
  });

  it('detects codeshares', () => {
    assert.equal(toFlight(row({ codeshareStatus: 'IsCodeshared' }), 'departure').isCodeshare, true);
    assert.equal(toFlight(row({ codeshareStatus: 'IsOperator' }), 'departure').isCodeshare, false);
  });

  it('survives missing optional fields', () => {
    const flight = toFlight(
      { movement: movement(), number: 'XX 1', status: 'Expected' },
      'arrival',
    );

    assert.equal(flight.airline, 'Unknown airline');
    assert.equal(flight.aircraft, undefined);
    assert.equal(flight.terminal, undefined);
    assert.equal(flight.isCargo, false);
    assert.equal(flight.isCodeshare, false);
  });

  it('survives a movement with no airport at all', () => {
    const flight = toFlight({ movement: { scheduledTime: { utc: '2026-08-19 07:00Z' } } }, 'departure');

    assert.equal(flight.counterpart.iata, '');
    assert.equal(flight.counterpart.name, 'Unknown airport');
  });

  it('carries terminal and check-in desk through', () => {
    const flight = toFlight(
      row({ movement: movement({ terminal: '2', checkInDesk: 'B' }) }),
      'departure',
    );

    assert.equal(flight.terminal, '2');
    assert.equal(flight.checkInDesk, 'B');
  });

  it('builds an id from the number and scheduled time', () => {
    assert.equal(toFlight(row(), 'departure').id, 'TP 1351@2026-08-19T07:00:00.000Z');
  });
});

describe('toFlights', () => {
  it('returns an empty array for anything that is not a list', () => {
    for (const input of [undefined, null, {}, 'nope']) {
      assert.deepEqual(toFlights(input, 'departure'), []);
    }
  });

  it('drops movements that cannot be placed in time', () => {
    const rows = [row(), { number: 'NO TIME' }, row()];
    assert.equal(toFlights(rows, 'departure').length, 2);
  });

  it('orders by scheduled time regardless of input order', () => {
    const rows = [
      row({ number: 'C 3', movement: movement({ utc: '2026-08-19 09:00Z' }) }),
      row({ number: 'A 1', movement: movement({ utc: '2026-08-19 07:00Z' }) }),
      row({ number: 'B 2', movement: movement({ utc: '2026-08-19 08:00Z' }) }),
    ];

    assert.deepEqual(
      toFlights(rows, 'departure').map((flight) => flight.number),
      ['A 1', 'B 2', 'C 3'],
    );
  });

  it('stamps every flight with the direction it was queried for', () => {
    const flights = toFlights([row(), row()], 'arrival');
    assert.ok(flights.every((flight) => flight.direction === 'arrival'));
  });
});
