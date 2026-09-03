import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from './HomePage';
import type { Flight } from '../models';
import { searchAirports, searchFlights } from '../services/api';

// Only the two calls are replaced. messageFromError and errorStatus stay real,
// because what a failure says to a user is part of what is being tested.
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  searchFlights: vi.fn(),
  searchAirports: vi.fn(),
}));

const flights = vi.mocked(searchFlights);
const airports = vi.mocked(searchAirports);

const flight = (number: string): Flight => ({
  id: `${number}-2026-09-01T08:00:00Z`,
  number,
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-01T08:00:00Z',
  scheduledLocal: '2026-09-01T09:00+01:00',
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
});

const SEARCH = '/?airport=LHR&direction=departure&from=2026-09-01T08:00&to=2026-09-01T12:00';

function show(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  flights.mockReset();
  airports.mockReset();
  airports.mockResolvedValue([]);
});

describe('what a screen reader is told', () => {
  it('has a live region before there is anything to announce', () => {
    show('/');

    // A region that appears at the same moment as its text is often missed.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('announces the count, not the table', async () => {
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 2,
      flights: [flight('BA 117'), flight('BA 175')],
    });

    show(SEARCH);

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('2 departures at LHR'));

    // The table is the thing a reader navigates. Announcing it would read out
    // every row, which is what the old live region on the results block did.
    const table = screen.getByRole('table');
    expect(table.closest('[aria-live]')).toBeNull();
    expect(screen.getByRole('status').contains(table)).toBe(false);
  });

  it('says a search is running', async () => {
    flights.mockImplementation(() => new Promise(() => {}));

    show(SEARCH);

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Searching flights'));
  });

  it('says when a window came back empty', async () => {
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 0,
      flights: [],
    });

    show(SEARCH);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('No flights in that window'),
    );
  });

  it('names arrivals as arrivals', async () => {
    flights.mockResolvedValue({
      airport: 'CDG',
      direction: 'arrival',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 1,
      flights: [{ ...flight('AF 1680'), direction: 'arrival' }],
    });

    show('/?airport=CDG&direction=arrival&from=2026-09-01T08:00&to=2026-09-01T12:00');

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 arrivals at CDG'));
  });

  it('sends a failure to an alert rather than a polite status', async () => {
    flights.mockRejectedValue(new Error('down'));

    show(SEARCH);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Search failed');
    // An error interrupts. A count waits its turn. They are not the same region.
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('the search in the URL', () => {
  it('runs the search a link arrived with', async () => {
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 1,
      flights: [flight('BA 117')],
    });

    show(SEARCH);

    // Waited on the table rather than on the call count: the count is 1 the
    // moment the search starts, so asserting it there would pass even if the
    // effect went on to fire again for every render after it.
    await screen.findByRole('table');

    expect(flights).toHaveBeenCalledTimes(1);
    expect(flights).toHaveBeenCalledWith({
      airport: 'LHR',
      direction: 'departure',
      fromLocal: '2026-09-01T08:00',
      toLocal: '2026-09-01T12:00',
    });
  });

  it('shows the empty form for a half-written URL instead of an error', async () => {
    show('/?airport=LON&from=nonsense');

    expect(screen.getByRole('heading', { name: 'Flight schedules' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(flights).not.toHaveBeenCalled();
  });
});

describe('narrowing the board to one destination', () => {
  const bound = (number: string, iata: string, city: string): Flight => ({
    ...flight(number),
    id: `${number}-${iata}`,
    counterpart: { iata, name: `${city} International`, municipality: city },
  });

  const mixed = () =>
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 3,
      flights: [
        bound('BA 117', 'JFK', 'New York'),
        bound('BA 175', 'JFK', 'New York'),
        bound('BA 304', 'CDG', 'Paris'),
      ],
    });

  const rows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

  it('shows only that destination, without asking for the data again', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await screen.findByRole('table');
    expect(rows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /New York/ }));

    expect(rows()).toHaveLength(2);
    // The filter is a view over data already fetched. Asking again would spend
    // an AeroDataBox unit to rearrange rows that are already on screen.
    expect(flights).toHaveBeenCalledTimes(1);
  });

  it('says what it is showing, and out of how many', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /New York/ }));

    expect(screen.getByRole('status').textContent).toBe('2 of 3 departures, to JFK');
  });

  it('gives the whole board back', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /New York/ }));
    await user.click(screen.getByRole('button', { name: 'Show all destinations' }));

    expect(rows()).toHaveLength(3);
    expect(screen.getByRole('status').textContent).toBe('3 departures at LHR');
  });
});
