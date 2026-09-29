import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CountryPicker from './CountryPicker';
import type { CountryGroup } from '../lib/countries';

const countries: CountryGroup[] = [
  { code: 'US', name: 'United States', count: 42 },
  { code: 'FR', name: 'France', count: 9 },
  { code: '', name: 'Unknown', count: 2 },
];

function show(value: string | null = 'US', list = countries) {
  const onChange = vi.fn();
  render(<CountryPicker countries={list} value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

const control = () => screen.getByRole('combobox', { name: 'Showing flights to' });
const options = () => screen.queryAllByRole('option');
const list = () => document.querySelector('.picker__list');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what it shows before it is opened', () => {
  it('names the country and how many go there', () => {
    show();

    expect(control().textContent).toContain('United States (42)');
  });

  it('has no list on the page at all', () => {
    show();

    // Not merely hidden: a list nobody has asked for should not be in the
    // tab order or read out.
    expect(options()).toHaveLength(0);
  });

  it('says what it is for', () => {
    show();

    expect(control().getAttribute('aria-expanded')).toBe('false');
  });

  it('is not there when there is nothing to choose between', () => {
    render(<CountryPicker countries={[]} value={null} onChange={vi.fn()} />);

    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('opening it', () => {
  it('offers every country with how many go there', async () => {
    const { user } = show();
    await user.click(control());

    // The count is what makes the choice: it says which are worth looking at.
    expect(options().map((option) => option.textContent)).toEqual([
      'United States42',
      'France9',
      'Unknown2',
    ]);
  });

  it('marks the one the board is on', async () => {
    const { user } = show('FR');
    await user.click(control());

    const marked = options().filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain('France');
  });

  it('opens downward when there is room', async () => {
    const { user } = show();
    await user.click(control());

    // The one place it must not cover is the search directly above it.
    expect(list()?.className).not.toContain('picker__list--up');
  });

  it('opens upward only when there is no room below', async () => {
    vi.stubGlobal('innerHeight', 700);
    const { user } = show();

    // Sitting near the bottom, with plenty of room above.
    control().getBoundingClientRect = () => ({ top: 640, bottom: 680 }) as DOMRect;
    await user.click(control());

    expect(list()?.className).toContain('picker__list--up');
  });
});

describe('choosing one', () => {
  it('reports the country that was picked', async () => {
    const { onChange, user } = show();
    await user.click(control());
    await user.click(screen.getByRole('option', { name: /France/ }));

    expect(onChange).toHaveBeenCalledWith('FR');
  });

  it('closes afterwards', async () => {
    const { user } = show();
    await user.click(control());
    await user.click(screen.getByRole('option', { name: /France/ }));

    expect(options()).toHaveLength(0);
  });

  it('says nothing when the one already showing is picked again', async () => {
    const { onChange, user } = show();
    await user.click(control());
    await user.click(screen.getByRole('option', { name: /United States/ }));

    // Reporting it would clear the destination chip for no reason.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can reach the flights with no country', async () => {
    const { onChange, user } = show();
    await user.click(control());
    await user.click(screen.getByRole('option', { name: /Unknown/ }));

    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('from the keyboard', () => {
  it('opens on the down arrow', async () => {
    const { user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}');

    expect(options()).toHaveLength(3);
  });

  it('opens where the board already is, not at the top', async () => {
    const { user } = show('FR');
    control().focus();
    await user.keyboard('{ArrowDown}');

    // A list of forty that opens at the top makes the reader hunt for where
    // they already are.
    expect(control().getAttribute('aria-activedescendant')).toBe(options()[1].id);
  });

  it('moves down the list and chooses with enter', async () => {
    const { onChange, user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('FR');
  });

  it('jumps to the ends', async () => {
    const { onChange, user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}{End}{Enter}');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('stops at the last one rather than wrapping round', async () => {
    const { onChange, user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('closes on escape without choosing', async () => {
    const { onChange, user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}{ArrowDown}{Escape}');

    expect(options()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives focus back to the control after choosing', async () => {
    const { user } = show();
    control().focus();

    await user.keyboard('{ArrowDown}{Enter}');

    // Otherwise the next tab starts from the top of the page.
    expect(document.activeElement).toBe(control());
  });
});

describe('clicking away', () => {
  it('closes it', async () => {
    const { user } = show();
    await user.click(control());
    expect(options()).toHaveLength(3);

    await user.click(document.body);

    expect(options()).toHaveLength(0);
  });
});
