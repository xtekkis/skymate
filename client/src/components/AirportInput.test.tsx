import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AirportInput from './AirportInput';
import type { Airport } from '../models';
import { searchAirports } from '../services/api';

vi.mock('../services/api', () => ({ searchAirports: vi.fn() }));

const lookup = vi.mocked(searchAirports);

const HEATHROW: Airport = {
  iata: 'LHR',
  name: 'London Heathrow',
  municipality: 'London',
  countryCode: 'GB',
};

const GATWICK: Airport = {
  iata: 'LGW',
  name: 'London Gatwick',
  municipality: 'London',
  countryCode: 'GB',
};

/** The component debounces at 250ms. Long enough to be sure nothing fired. */
const PAST_DEBOUNCE = 400;
const settle = () => new Promise((resolve) => setTimeout(resolve, PAST_DEBOUNCE));

const field = () => screen.getByRole('combobox') as HTMLInputElement;

/**
 * The input is controlled, so a bare render would never see the value come
 * back. This holds the code the way SearchForm does, which is the only way the
 * undo-on-typing and seed-from-outside paths behave as they do in the app.
 */
function renderField(initial = '') {
  const onSelect = vi.fn();

  function Host() {
    const [value, setValue] = useState(initial);
    return (
      <AirportInput
        value={value}
        onSelect={(iata) => {
          setValue(iata);
          onSelect(iata);
        }}
      />
    );
  }

  render(<Host />);
  return { onSelect, user: userEvent.setup() };
}

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue([HEATHROW, GATWICK]);
});

describe('typing', () => {
  it('drops digits, since no airport code contains one', async () => {
    const { user } = renderField();

    await user.type(field(), 'lhr123');

    expect(field().value).toBe('lhr');
  });

  it('does not ask the server about a single character', async () => {
    const { user } = renderField();

    await user.type(field(), 'l');
    await settle();

    // Every keystroke below the minimum would be a request that can only come
    // back with everything.
    expect(lookup).not.toHaveBeenCalled();
  });

  it('asks once for a burst of typing rather than once per key', async () => {
    const { user } = renderField();

    await user.type(field(), 'london');

    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    expect(lookup).toHaveBeenCalledWith('london');
  });
});

describe('choosing an airport', () => {
  it('reports the code and names the airport underneath', async () => {
    const { user, onSelect } = renderField();

    await user.type(field(), 'lond');
    await user.click(await screen.findByRole('option', { name: /London Heathrow/ }));

    expect(onSelect).toHaveBeenCalledWith('LHR');
    expect(field().value).toBe('LHR');
    expect(screen.getByText('London Heathrow')).toBeTruthy();
  });

  it('undoes the choice when typing resumes, keeping what was typed', async () => {
    const { user, onSelect } = renderField();

    await user.type(field(), 'lond');
    await user.click(await screen.findByRole('option', { name: /London Heathrow/ }));
    await user.type(field(), 'x');

    // A half-typed code must never submit as though it had been picked.
    expect(onSelect).toHaveBeenLastCalledWith('');
    // ...but undoing the choice is not the same as clearing the field.
    expect(field().value).toBe('LHRx');
  });
});

describe('the keyboard', () => {
  it('moves through the list and picks with Enter', async () => {
    const { user, onSelect } = renderField();

    await user.type(field(), 'lond');
    await screen.findByRole('listbox');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('LGW');
  });

  it('tells a screen reader which option is highlighted', async () => {
    const { user } = renderField();

    await user.type(field(), 'lond');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');

    expect(field().getAttribute('aria-activedescendant')).toBe(options[0].id);

    await user.keyboard('{ArrowDown}');

    expect(field().getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });
});

describe('a code that arrived from outside the form', () => {
  it('is looked up so the field shows an airport, not a bare code', async () => {
    renderField('LHR');

    expect(await screen.findByText('London Heathrow')).toBeTruthy();
    expect(field().value).toBe('LHR');
    expect(lookup).toHaveBeenCalledWith('LHR');
  });

  it('is looked up once, not on every render', async () => {
    const { user } = renderField('LHR');

    await screen.findByText('London Heathrow');
    await user.click(field());
    await settle();

    // The seeding effect feeding itself is how a shared link turns into a
    // request per render.
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('still works when the name never arrives', async () => {
    lookup.mockRejectedValue(new Error('offline'));
    renderField('LHR');

    await settle();

    expect(field().value).toBe('LHR');
    expect(screen.getByText('Type a city or airport name')).toBeTruthy();
  });
});
