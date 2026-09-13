import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchSheet from './SearchSheet';
import type { SearchParams } from '../models';
import { searchAirports } from '../services/api';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  searchAirports: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(searchAirports).mockResolvedValue([]);
});

const restored: SearchParams = {
  airport: 'LHR',
  direction: 'departure',
  fromLocal: '2026-09-01T08:00',
  toLocal: '2026-09-01T16:00',
};

function show(airport = 'LHR', onSearch = vi.fn()) {
  render(
    <SearchSheet
      airport={airport}
      direction="departure"
      onSearch={onSearch}
      initial={airport ? restored : null}
    />,
  );

  return onSearch;
}

const bar = () => screen.getByRole('button', { name: /LHR departures|Choose an airport/ });
const fields = () => screen.queryByRole('combobox', { name: 'Airport' });

describe('the search, folded away', () => {
  it('says what the board is showing without being opened', () => {
    show();

    expect(bar().textContent).toContain('LHR');
    expect(bar().textContent).toContain('departures');
  });

  it('starts closed once there is something to look at', () => {
    show();

    // The flights are the page. A form over them is not.
    expect(fields()).toBeNull();
    expect(bar().getAttribute('aria-expanded')).toBe('false');
  });

  it('starts open when the board is empty', () => {
    show('');

    // Nothing to read yet, so the only useful thing on screen is the form.
    expect(fields()).toBeTruthy();
    expect(bar().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens and closes on the bar', async () => {
    const user = userEvent.setup();
    show();

    await user.click(bar());
    expect(fields()).toBeTruthy();

    await user.click(bar());
    expect(fields()).toBeNull();
  });

  it('takes its fields out of the page rather than hiding them', async () => {
    const user = userEvent.setup();
    show();

    await user.click(bar());
    await user.click(bar());

    // Hidden fields stay in the tab order behind a bar that says closed.
    expect(screen.queryByLabelText('Window')).toBeNull();
  });

  it('says which thing it opens', async () => {
    const user = userEvent.setup();
    show();

    await user.click(bar());

    const panel = bar().getAttribute('aria-controls');
    expect(panel).toBeTruthy();
    expect(document.getElementById(panel!)).toBeTruthy();
  });

  it('folds away again once a search is asked for', async () => {
    const user = userEvent.setup();
    const onSearch = show();

    await user.click(bar());
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalled();
    // What it just asked for is the next thing worth looking at.
    expect(fields()).toBeNull();
  });

  it('carries the same window the sidebar would have sent', async () => {
    const user = userEvent.setup();
    const onSearch = show();

    await user.click(bar());
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(restored);
  });
});
