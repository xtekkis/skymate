import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CountryPicker from './CountryPicker';
import type { CountryGroup } from './countries';

const countries: CountryGroup[] = [
  { code: 'US', name: 'United States', count: 42 },
  { code: 'FR', name: 'France', count: 9 },
  { code: '', name: 'Unknown', count: 2 },
];

function show(value: string | null = 'US', list = countries) {
  const onChange = vi.fn();
  render(<CountryPicker countries={list} value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup(), select: screen.queryByRole('combobox') };
}

describe('choosing which country the board shows', () => {
  it('offers every country on the board, with how many go there', () => {
    show();

    // The count is what makes the choice: it says which ones are worth
    // looking at before you look.
    expect(screen.getByRole('option', { name: 'United States (42)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'France (9)' })).toBeTruthy();
  });

  it('offers the flights with no country as well', () => {
    show();

    // Only one country shows at a time, so leaving these out would put them
    // beyond reach entirely.
    expect(screen.getByRole('option', { name: 'Unknown (2)' })).toBeTruthy();
  });

  it('shows which one is chosen', () => {
    const { select } = show('FR');

    expect((select as HTMLSelectElement).value).toBe('FR');
  });

  it('says what it is for', () => {
    show();

    expect(screen.getByLabelText('Showing flights to')).toBeTruthy();
  });

  it('reports the country that was picked', async () => {
    const { onChange, user } = show();

    await user.selectOptions(screen.getByRole('combobox'), 'FR');

    expect(onChange).toHaveBeenCalledWith('FR');
  });

  it('is not there at all when there is nothing to choose between', () => {
    const { select } = show(null, []);

    expect(select).toBeNull();
  });
});
