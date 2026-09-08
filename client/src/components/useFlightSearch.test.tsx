import { act, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFlightSearch } from './useFlightSearch';
import type { SearchParams } from '../models';
import { searchFlights } from '../services/api';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  searchFlights: vi.fn(),
}));

const flights = vi.mocked(searchFlights);

const PARAMS: SearchParams = {
  airport: 'LHR',
  direction: 'departure',
  fromLocal: '2026-09-04T08:00',
  toLocal: '2026-09-04T16:00',
};

const response = (count: number) => ({
  airport: 'LHR',
  direction: 'departure' as const,
  from: PARAMS.fromLocal,
  to: PARAMS.toLocal,
  count,
  flights: [],
});

/** Renders the hook and prints everything it reports, for the test to read. */
function Probe(params: SearchParams) {
  const { phase, result, error, status } = useFlightSearch(params);

  return (
    <ul>
      <li data-testid="phase">{phase}</li>
      <li data-testid="count">{result ? String(result.count) : '-'}</li>
      <li data-testid="error">{error}</li>
      <li data-testid="status">{status ? String(status) : '-'}</li>
    </ul>
  );
}

const read = (key: string) => screen.getByTestId(key).textContent;

const show = (params: SearchParams = PARAMS) => render(<Probe {...params} />);

beforeEach(() => {
  flights.mockReset();
});

describe('asking for a window', () => {
  it('asks once, with what it was given', async () => {
    flights.mockResolvedValue(response(0));
    show();

    await waitFor(() => expect(flights).toHaveBeenCalledTimes(1));
    expect(flights).toHaveBeenCalledWith(PARAMS);
  });

  it('says it is searching before it says anything else', () => {
    flights.mockImplementation(() => new Promise(() => {}));
    show();

    expect(read('phase')).toBe('loading');
  });

  it('hands back what came', async () => {
    flights.mockResolvedValue(response(34));
    show();

    await waitFor(() => expect(read('phase')).toBe('done'));
    expect(read('count')).toBe('34');
  });
});

describe('when the window changes', () => {
  it('asks again', async () => {
    flights.mockResolvedValue(response(0));
    const { rerender } = show();

    await waitFor(() => expect(flights).toHaveBeenCalledTimes(1));
    rerender(<Probe {...PARAMS} airport="CDG" />);

    await waitFor(() => expect(flights).toHaveBeenCalledTimes(2));
    expect(flights).toHaveBeenLastCalledWith({ ...PARAMS, airport: 'CDG' });
  });

  it('does not ask again for the same window', async () => {
    flights.mockResolvedValue(response(0));
    const { rerender } = show();

    await waitFor(() => expect(flights).toHaveBeenCalledTimes(1));
    // A caller building its params inline hands over a new object every
    // render. That must not be a new search: it is an AeroDataBox unit.
    rerender(<Probe {...{ ...PARAMS }} />);
    rerender(<Probe {...{ ...PARAMS }} />);

    expect(flights).toHaveBeenCalledTimes(1);
  });

  it('ignores a slow answer that a newer one has overtaken', async () => {
    let landFirst: (value: ReturnType<typeof response>) => void = () => {};
    flights.mockImplementationOnce(() => new Promise((resolve) => (landFirst = resolve)));
    flights.mockResolvedValueOnce(response(2));

    const { rerender } = show();
    rerender(<Probe {...PARAMS} airport="CDG" />);
    await waitFor(() => expect(read('count')).toBe('2'));

    landFirst(response(99));
    // Let the overtaken promise settle. waitFor would check before its
    // microtask ran and pass without ever seeing the overwrite.
    await act(async () => {
      await Promise.resolve();
    });

    // The first window is not the one on screen any more.
    expect(read('count')).toBe('2');
  });
});

describe('when nothing can be asked', () => {
  it('stays idle rather than spending a request', () => {
    show({ ...PARAMS, airport: '' });

    // The server would refuse this. There is no reason to find out.
    expect(read('phase')).toBe('idle');
    expect(flights).not.toHaveBeenCalled();
  });

  it('refuses a half-written window too', () => {
    show({ ...PARAMS, toLocal: 'tomorrow' });

    expect(flights).not.toHaveBeenCalled();
  });
});

describe('when it fails', () => {
  it('reports the wording and the status behind it', async () => {
    flights.mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 503,
        data: { error: 'The monthly flight data allowance is used up.' },
        statusText: '',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse),
    );
    show();

    await waitFor(() => expect(read('phase')).toBe('error'));
    expect(read('error')).toBe('The monthly flight data allowance is used up.');
    // The status is what tells a site-wide condition from this one search.
    expect(read('status')).toBe('503');
  });

  it('says something generic when the failure carried no wording', async () => {
    flights.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.4'));
    show();

    await waitFor(() => expect(read('phase')).toBe('error'));
    expect(read('error')).toBe('Something went wrong. Try again.');
  });
});
