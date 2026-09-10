import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { getFlightByNumber, searchAirports } from './services/api';

vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  searchAirports: vi.fn(),
  searchFlights: vi.fn(),
  getFlightByNumber: vi.fn(),
  sendChat: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(searchAirports).mockResolvedValue([]);
  window.history.pushState({}, '', '/');
});

describe('the tab order', () => {
  /*
   * On a route that still has the site header. The board has a masthead
   * instead, which carries no navigation on purpose.
   */
  function showHeaderPage() {
    vi.mocked(getFlightByNumber).mockResolvedValue({ number: 'BA117', count: 0, flights: [] });
    window.history.pushState({}, '', '/flight/BA117');
    render(<App />);
  }

  it('starts on the first link that goes somewhere new', async () => {
    const user = userEvent.setup();
    showHeaderPage();

    await user.tab();

    // The wordmark is skipped: it leads where Flights leads.
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Flights' }));
  });

  it('keeps the wordmark clickable, just not a stop', () => {
    showHeaderPage();

    const brand = screen.getByRole('link', { name: 'Skymate' });
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.getAttribute('tabindex')).toBe('-1');
  });

  it('has a main that navigation can move focus to', () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(main.id).toBe('main');
    // Landmarks are not focusable by default, so it needs this.
    expect(main.getAttribute('tabindex')).toBe('-1');
  });
});

describe('the assistant', () => {
  it('is reachable from every page, not one of them', async () => {
    vi.mocked(getFlightByNumber).mockResolvedValue({ number: 'BA117', count: 0, flights: [] });
    render(<App />);

    expect(screen.getByRole('button', { name: 'Travel assistant' })).toBeTruthy();

    // It used to be a destination in the header. Now it follows you.
    expect(screen.queryByRole('link', { name: 'Assistant' })).toBeNull();
  });
});

describe('changing route', () => {
  it('moves focus into the new page rather than leaving it on the nav', async () => {
    vi.mocked(getFlightByNumber).mockResolvedValue({ number: 'BA117', count: 0, flights: [] });
    window.history.pushState({}, '', '/flight/BA117');

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Flights' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Flight board' })).toBeTruthy(),
    );
    // Without this, Tab would walk the header again instead of the page.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));
  });

  it('leaves focus alone on first load', () => {
    render(<App />);

    // Stealing focus before anyone has asked for it is its own bug.
    expect(document.activeElement).toBe(document.body);
  });

  it('does not steal focus when only the search in the URL changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    // The window-length select is a combobox as well, so name the one meant.
    const airport = screen.getByRole('combobox', { name: 'Airport' });
    await user.click(airport);

    // A search rewrites the query string, not the path. Focus must stay put.
    window.history.pushState({}, '', '/?airport=LHR');
    expect(document.activeElement).toBe(airport);
  });
});

describe('which header a route gets', () => {
  it('gives the board its masthead instead of the site header', () => {
    render(<App />);

    expect(screen.getByText('Board live')).toBeTruthy();
    // The masthead carries no navigation. That is the design, not an omission.
    expect(screen.queryByRole('link', { name: 'Flights' })).toBeNull();
  });

  it('gives every other route the site header', async () => {
    vi.mocked(getFlightByNumber).mockResolvedValue({ number: 'BA117', count: 0, flights: [] });
    window.history.pushState({}, '', '/flight/BA117');

    render(<App />);

    expect(screen.getByRole('link', { name: 'Flights' })).toBeTruthy();
    expect(screen.queryByText('Board live')).toBeNull();
  });

  it('names the airport the board is showing, read from the URL', () => {
    window.history.pushState({}, '', '/?airport=CDG&direction=arrival&from=2026-09-01T08:00&to=2026-09-01T12:00');

    render(<App />);

    expect(screen.getByText('CDG')).toBeTruthy();
    expect(screen.getByText(/arrivals/)).toBeTruthy();
  });

  it('says nothing about an airport nobody has chosen', () => {
    render(<App />);

    // " · departures" beside an empty code reads as a bug, not as an empty
    // board.
    expect(screen.queryByText(/departures/)).toBeNull();
  });
});
