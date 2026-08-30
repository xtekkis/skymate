import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { searchAirports } from './services/api';

vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  searchAirports: vi.fn(),
  searchFlights: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(searchAirports).mockResolvedValue([]);
  window.history.pushState({}, '', '/');
});

describe('the tab order', () => {
  it('starts on the first link that goes somewhere new', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();

    // The wordmark is skipped: it leads where Flights leads.
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Flights' }));
  });

  it('keeps the wordmark clickable, just not a stop', () => {
    render(<App />);

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

describe('changing route', () => {
  it('moves focus into the new page rather than leaving it on the nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Assistant' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Travel assistant' })).toBeTruthy(),
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
