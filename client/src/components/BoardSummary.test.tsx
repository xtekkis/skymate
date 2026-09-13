import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import BoardSummary from './BoardSummary';
import type { Flight } from '../models';

/*
 * Athens. A browser in a zone with no daylight saving would pass the window
 * tests below either way, which is exactly how this bug survives: the times in
 * a search belong to the airport, not to whoever is looking at them.
 */
beforeAll(() => {
  vi.stubEnv('TZ', 'Europe/Athens');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const bound = (number: string, iata: string, city: string, time: string): Flight =>
  ({
    id: `${number}-${iata}`,
    number,
    status: 'Expected',
    scheduledTime: `2026-09-01T${time}:00Z`,
    scheduledLocal: `2026-09-01T${time}`,
    counterpart: { iata, name: `${city} International`, municipality: city },
  }) as unknown as Flight;

const flights = [
  bound('BA 117', 'JFK', 'New York', '08:15'),
  bound('BA 175', 'JFK', 'New York', '09:40'),
  bound('BA 304', 'CDG', 'Paris', '08:50'),
];

/** The headline number, which a chip count can otherwise be mistaken for. */
const headline = () => document.querySelector('.summary__number')?.textContent;

function show(overrides: Partial<Parameters<typeof BoardSummary>[0]> = {}) {
  const onSelect = vi.fn();

  render(
    <BoardSummary
      flights={flights}
      direction="departure"
      airport="LHR"
      from="2026-09-01T08:00"
      to="2026-09-01T20:00"
      shown={flights.length}
      selected={null}
      onSelect={onSelect}
      {...overrides}
    />,
  );

  return onSelect;
}

describe('what the window came back with', () => {
  it('leads with the number that is on the board', () => {
    show();

    expect(headline()).toBe('3');
    expect(screen.getByText(/departures at/).textContent).toContain('LHR');
  });

  it('names arrivals as arrivals', () => {
    show({ direction: 'arrival' });

    expect(screen.getByText(/arrivals at/)).toBeTruthy();
  });

  it('says how much of the window is on screen once narrowed', () => {
    show({ selected: 'JFK', shown: 2 });

    expect(headline()).toBe('2');
    expect(screen.getByText(/of 3 departures, to/).textContent).toContain('JFK');
  });

  it('shows dashes while a search is running, not the previous count', () => {
    show({ isSearching: true });

    // The number on screen belongs to the search being replaced.
    expect(headline()).toBe('--');
  });
});

describe('the window it is showing', () => {
  it('shows an overnight window as two clock times', () => {
    show({ from: '2026-09-01T17:00', to: '2026-09-02T01:00' });

    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.getByText('01:00')).toBeTruthy();
  });

  it('shows an hour that does not exist where the reader is sitting', () => {
    // 29 March 2026 is the morning the clocks go forward in Athens: 03:00
    // becomes 04:00, so 03:30 is an hour that does not happen there. It
    // happens at the airport, which is the only place these strings are about.
    // new Date('2026-03-29T03:30') in Athens quietly becomes 04:30, which is
    // how a parsed wall clock ends up showing a window nobody searched for.
    show({ from: '2026-03-29T03:30', to: '2026-03-29T11:30' });

    expect(screen.getByText('03:30')).toBeTruthy();
    expect(screen.queryByText('04:30')).toBeNull();
  });
});

describe('the destinations', () => {
  it('counts them off the board rather than asking again', () => {
    show();

    expect(screen.getByRole('button', { name: /JFK New York, 2 flights/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /CDG Paris, 1 flights/ })).toBeTruthy();
  });

  it('narrows to the one that was pressed', async () => {
    const user = userEvent.setup();
    const onSelect = show();

    await user.click(screen.getByRole('button', { name: /New York/ }));

    expect(onSelect).toHaveBeenCalledWith('JFK');
  });

  it('gives the whole board back when the chosen one is pressed again', async () => {
    const user = userEvent.setup();
    const onSelect = show({ selected: 'JFK', shown: 2 });

    await user.click(screen.getByRole('button', { name: /New York/ }));

    // There is no separate clear button, so a chip that cannot be unpressed
    // would strand the reader on one destination.
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('says which one is chosen, not only by colour', () => {
    show({ selected: 'JFK', shown: 2 });

    expect(screen.getByRole('button', { name: /New York/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /Paris/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('shows no chips at all when nothing came back', () => {
    show({ flights: [], shown: 0 });

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the chips alone', () => {
  it('keeps every destination the full card would have shown', () => {
    show({ compact: true });

    expect(screen.getByRole('button', { name: /JFK New York, 2 flights/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /CDG Paris, 1 flights/ })).toBeTruthy();
  });

  it('drops the chrome that a narrow screen has no room for', () => {
    show({ compact: true });

    expect(screen.queryByText('02 | Where today goes')).toBeNull();
    expect(screen.queryByText(/departures at/)).toBeNull();
    expect(screen.queryByText('local', { exact: false })).toBeNull();
  });

  it('still narrows the board when one is pressed', async () => {
    const user = userEvent.setup();
    const onSelect = show({ compact: true });

    await user.click(screen.getByRole('button', { name: /New York/ }));

    expect(onSelect).toHaveBeenCalledWith('JFK');
  });

  it('still says which one is chosen', () => {
    show({ compact: true, selected: 'JFK', shown: 2 });

    expect(screen.getByRole('button', { name: /New York/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('is still findable as the place the filters live', () => {
    show({ compact: true });

    // A card in the list beside it names the same city, so anything looking
    // for a chip needs somewhere to look.
    expect(screen.getByRole('region', { name: 'What is on the board' })).toBeTruthy();
  });
});
