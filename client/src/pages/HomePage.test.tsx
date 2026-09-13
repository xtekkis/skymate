import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('announces the count, not the board', async () => {
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

    // The board is the thing a reader navigates. Announcing it would read out
    // every card, which is what the old live region on the results block did.
    const card = screen.getByRole('button', { name: /BA 117/ });
    expect(card.closest('[aria-live]')).toBeNull();
    expect(screen.getByRole('status').contains(card)).toBe(false);
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

    // Waited on a card rather than on the call count: the count is 1 the
    // moment the search starts, so asserting it there would pass even if the
    // effect went on to fire again for every render after it.
    await screen.findByRole('button', { name: /BA 117/ });

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

    expect(screen.getByRole('heading', { name: 'Flight board' })).toBeTruthy();
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

  /*
   * The chips and the cards are both buttons naming the same city now, so a
   * bare /New York/ matches four things. The chips live in the sidebar.
   */
  const side = () => within(screen.getByRole('complementary'));
  const cards = () => Array.from(document.querySelectorAll('.stage__canvas .card'));
  const onBoard = (count: number) => waitFor(() => expect(cards()).toHaveLength(count));

  it('shows only that destination, without asking for the data again', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await onBoard(3);

    await user.click(side().getByRole('button', { name: /New York/ }));

    expect(cards()).toHaveLength(2);
    // The filter is a view over data already fetched. Asking again would spend
    // an AeroDataBox unit to rearrange rows that are already on screen.
    expect(flights).toHaveBeenCalledTimes(1);
  });

  it('says what it is showing, and out of how many', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await onBoard(3);
    await user.click(side().getByRole('button', { name: /New York/ }));

    expect(screen.getByRole('status').textContent).toBe('2 of 3 departures, to JFK');
  });

  it('gives the whole board back', async () => {
    mixed();
    const user = userEvent.setup();
    show(SEARCH);

    await onBoard(3);
    await user.click(side().getByRole('button', { name: /New York/ }));
    await user.click(side().getByRole('button', { name: /New York/ }));

    expect(cards()).toHaveLength(3);
    expect(screen.getByRole('status').textContent).toBe('3 departures at LHR');
  });
});

describe('what the board takes over from the document', () => {
  const theme = () => document.documentElement.getAttribute('data-theme');

  it('is dark even when the reader has chosen light', () => {
    document.documentElement.setAttribute('data-theme', 'light');

    show('/');

    // The masthead carries no theme toggle, so a light board is one the
    // reader cannot get out of.
    expect(theme()).toBe('dark');
  });

  it('gives the chosen theme back on the way out', () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const view = show('/');
    view.unmount();

    expect(theme()).toBe('light');
  });

  it('leaves the system preference alone when nothing was chosen', () => {
    document.documentElement.removeAttribute('data-theme');

    const view = show('/');
    expect(theme()).toBe('dark');

    view.unmount();

    // Putting "light" back would be inventing a choice nobody made.
    expect(theme()).toBeNull();
  });

  it('stops the document scrolling behind the board', () => {
    show('/');

    expect(document.body.classList.contains('is-board')).toBe(true);
  });
});

describe('a window with no room for a time axis', () => {
  const realMatchMedia = window.matchMedia;

  /** jsdom answers no media query, so a narrow window has to be said. */
  function width(narrow: boolean) {
    window.matchMedia = ((query: string) =>
      ({
        matches: narrow && query.includes('max-width'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  }

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  const board = () => document.querySelector('.stage');
  const list = () => document.querySelector('.board-list');

  function withFlights() {
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 2,
      flights: [flight('BA 117'), flight('BA 175')],
    });
  }

  it('shows the board when there is room for one', async () => {
    width(false);
    withFlights();
    show(SEARCH);

    await screen.findByRole('button', { name: /BA 117/ });

    expect(board()).toBeTruthy();
    expect(list()).toBeNull();
  });

  it('shows a list instead when there is not', async () => {
    width(true);
    withFlights();
    show(SEARCH);

    await screen.findByRole('button', { name: /BA 117/ });

    // 366px of controls beside a time axis leaves a phone nothing to read.
    expect(list()).toBeTruthy();
    expect(board()).toBeNull();
  });

  it('lists every flight the board would have carried', async () => {
    width(true);
    withFlights();
    show(SEARCH);

    await screen.findByRole('button', { name: /BA 117/ });

    expect(list()!.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /BA 175/ })).toBeTruthy();
  });

  it('folds the search into a bar rather than a card', async () => {
    width(true);
    withFlights();
    show(SEARCH);

    await screen.findByRole('button', { name: /BA 117/ });

    // The numbered eyebrow belongs to the sidebar's stack of cards, and there
    // is no stack here.
    expect(screen.queryByText('01 | Search')).toBeNull();
    expect(screen.getByRole('button', { name: /LHR departures/ })).toBeTruthy();
    expect(screen.getByText('02 | Where today goes')).toBeTruthy();
  });

  it('narrows to a destination here too', async () => {
    width(true);
    flights.mockResolvedValue({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
      count: 2,
      flights: [
        { ...flight('BA 117'), id: 'a', counterpart: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' } },
        { ...flight('BA 175'), id: 'b', counterpart: { iata: 'CDG', name: 'De Gaulle', municipality: 'Paris' } },
      ],
    });

    const user = userEvent.setup();
    show(SEARCH);

    await screen.findByRole('button', { name: /BA 117/ });
    // Scoped to the summary: a card in the list names the same city.
    const summary = screen.getByRole('region', { name: 'What is on the board' });
    await user.click(within(summary).getByRole('button', { name: /New York/ }));

    expect(list()!.querySelectorAll('li')).toHaveLength(1);
  });
});
