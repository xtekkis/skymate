import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchCard from './SearchCard';
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
  direction: 'arrival',
  fromLocal: '2026-09-01T08:00',
  toLocal: '2026-09-01T16:00',
};

const submit = () => screen.getByRole('button', { name: 'Search' });

describe('what the card sends', () => {
  it('turns the fields into a window the API takes', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchCard onSearch={onSearch} initial={restored} />);

    await user.click(submit());

    expect(onSearch).toHaveBeenCalledWith({
      airport: 'LHR',
      direction: 'arrival',
      fromLocal: '2026-09-01T08:00',
      toLocal: '2026-09-01T16:00',
    });
  });

  it('sends the direction that is currently chosen', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchCard onSearch={onSearch} initial={restored} />);

    await user.click(screen.getByRole('radio', { name: 'Departures' }));
    await user.click(submit());

    expect(onSearch.mock.calls[0][0].direction).toBe('departure');
  });

  it('sends the window that is currently chosen', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchCard onSearch={onSearch} initial={restored} />);

    await user.selectOptions(screen.getByLabelText('Window'), '4');
    await user.click(submit());

    expect(onSearch.mock.calls[0][0].toLocal).toBe('2026-09-01T12:00');
  });
});

describe('a window nobody could search', () => {
  it('is never sent, and says which field is missing', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchCard onSearch={onSearch} />);

    await user.click(submit());

    // An empty airport is a request the server refuses, so it must not cost
    // one of the six hundred AeroDataBox units we have a month.
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Choose an airport');
  });

  it('puts the cursor in the field that has to be fixed', async () => {
    const user = userEvent.setup();
    render(<SearchCard onSearch={vi.fn()} />);

    await user.click(submit());

    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Airport' }));
  });
});

describe('the controls the card offers', () => {
  it('restores what arrived in the link', () => {
    render(<SearchCard onSearch={vi.fn()} initial={restored} />);

    expect((screen.getByLabelText('Window') as HTMLSelectElement).value).toBe('8');
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-09-01');
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('08:00');
    expect(screen.getByRole('radio', { name: 'Arrivals' })).toHaveProperty('checked', true);
  });

  it('offers no window the API would refuse', () => {
    render(<SearchCard onSearch={vi.fn()} />);

    const offered = Array.from(
      screen.getByLabelText('Window').querySelectorAll('option'),
      (option) => Number(option.value),
    );

    // AeroDataBox caps a query at 12 hours. Offering more is a request spent
    // on a guaranteed error.
    expect(offered.length).toBeGreaterThan(0);
    for (const hours of offered) expect(hours).toBeLessThanOrEqual(12);
  });

  it('keeps the window select nameable, caret and all', () => {
    render(<SearchCard onSearch={vi.fn()} />);

    // The caret is drawn rather than native, and a decorative icon that joins
    // the accessible name is how a select ends up called "Window caret down".
    expect(screen.getByRole('combobox', { name: 'Window' })).toBeTruthy();
  });

  it('says the card is the first step', () => {
    render(<SearchCard onSearch={vi.fn()} />);

    expect(screen.getByText('01 | Search')).toBeTruthy();
  });
});
