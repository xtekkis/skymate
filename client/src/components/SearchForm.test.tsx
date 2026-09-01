import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchForm from './SearchForm';
import type { SearchParams } from '../models';
import { searchAirports } from '../services/api';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  searchAirports: vi.fn(),
}));

/*
 * Athens, and 29 March 2026 is the morning the clocks go forward. A browser in
 * a zone with no daylight saving would pass these tests either way, which is
 * exactly why the bug survived: the times in a search belong to the airport,
 * not to whoever is looking at them.
 */
beforeAll(() => {
  // stubEnv rather than touching process directly: this is browser code, and
  // its tsconfig quite rightly does not know Node globals exist.
  vi.stubEnv('TZ', 'Europe/Athens');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.mocked(searchAirports).mockResolvedValue([]);
});

const restored = (fromLocal: string, toLocal: string): SearchParams => ({
  airport: 'LHR',
  direction: 'departure',
  fromLocal,
  toLocal,
});

const windowValue = () => (screen.getByLabelText('Window') as HTMLSelectElement).value;

describe('restoring a window from a link', () => {
  it('keeps a four hour window across a clocks-forward morning', () => {
    render(<SearchForm onSearch={vi.fn()} initial={restored('2026-03-29T01:00', '2026-03-29T05:00')} />);

    // Measured in the browser's zone this is three hours, which is not a window
    // anyone can pick, so it used to fall back to twelve.
    expect(windowValue()).toBe('4');
  });

  it('keeps a twelve hour window across the same morning', () => {
    render(<SearchForm onSearch={vi.fn()} initial={restored('2026-03-29T01:00', '2026-03-29T13:00')} />);

    expect(windowValue()).toBe('12');
  });

  it('restores an ordinary window untouched', () => {
    render(<SearchForm onSearch={vi.fn()} initial={restored('2026-09-01T08:00', '2026-09-01T16:00')} />);

    expect(windowValue()).toBe('8');
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-09-01');
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('08:00');
  });

  it('falls back to twelve for a window nobody could have picked', () => {
    render(<SearchForm onSearch={vi.fn()} initial={restored('2026-09-01T08:00', '2026-09-01T15:00')} />);

    expect(windowValue()).toBe('12');
  });
});
