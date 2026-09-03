import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DestinationGrid from './DestinationGrid';
import { hueFor, toDestinations } from './destinations';
import type { Flight } from '../models';

const flight = (iata: string, name: string, time: string, id = `${iata}-${time}`): Flight => ({
  id,
  number: `BA ${id}`,
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata, name: `${name} International`, municipality: name },
  scheduledTime: `2026-09-01T${time}:00Z`,
  scheduledLocal: `2026-09-01T${time}+01:00`,
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
});

const grid = (flights: Flight[], selected: string | null = null) => {
  const onSelect = vi.fn();
  render(<DestinationGrid flights={flights} selected={selected} onSelect={onSelect} />);
  return { onSelect, user: userEvent.setup() };
};

const cards = () => screen.getAllByRole('button', { name: /flight/ });

describe('counting a board into destinations', () => {
  it('groups by airport and counts each one', () => {
    const found = toDestinations([
      flight('JFK', 'New York', '08:00'),
      flight('JFK', 'New York', '11:00'),
      flight('CDG', 'Paris', '09:00'),
    ]);

    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ iata: 'JFK', name: 'New York', count: 2 });
    expect(found[1]).toMatchObject({ iata: 'CDG', name: 'Paris', count: 1 });
  });

  it('keeps the earliest departure, whatever order they arrive in', () => {
    const found = toDestinations([
      flight('JFK', 'New York', '17:20'),
      flight('JFK', 'New York', '06:05'),
      flight('JFK', 'New York', '12:00'),
    ]);

    expect(found[0].earliest).toBe('06:05');
  });

  it('busiest first, and ties broken by who leaves soonest', () => {
    const found = toDestinations([
      flight('CDG', 'Paris', '06:00'),
      flight('JFK', 'New York', '09:00'),
      flight('JFK', 'New York', '10:00'),
      flight('AMS', 'Amsterdam', '05:00'),
    ]);

    expect(found.map((d) => d.iata)).toEqual(['JFK', 'AMS', 'CDG']);
  });

  it('shows at most eight, so the section stays a section', () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      flight(`X${index}`.padEnd(3, 'Z'), `City ${index}`, '08:00', `f${index}`),
    );

    expect(toDestinations(many)).toHaveLength(8);
  });

  it('skips a counterpart with no code, which cannot be filtered on', () => {
    const nameless = { ...flight('JFK', 'New York', '08:00'), counterpart: { iata: '', name: '?' } };

    expect(toDestinations([nameless])).toHaveLength(0);
  });
});

describe('the colour of a card', () => {
  it('is the same every time for the same place', () => {
    expect(hueFor('ATH')).toBe(hueFor('ATH'));
    expect(hueFor('JFK')).not.toBe(hueFor('ATH'));
  });

  it('is a hue, so the palette decides the rest', () => {
    for (const code of ['ATH', 'JFK', 'CDG', 'LHR', 'TLV', 'AMS']) {
      expect(hueFor(code)).toBeGreaterThanOrEqual(0);
      expect(hueFor(code)).toBeLessThan(360);
    }
  });
});

describe('the cards', () => {
  it('names the place, its code, and what leaves today', () => {
    grid([flight('JFK', 'New York', '08:00'), flight('JFK', 'New York', '11:30')]);

    const card = cards()[0];
    expect(within(card).getByText('JFK')).toBeTruthy();
    expect(within(card).getByText('New York')).toBeTruthy();
    expect(within(card).getByText(/2 flights/)).toBeTruthy();
    expect(within(card).getByText('08:00')).toBeTruthy();
  });

  it('says one flight, not one flights', () => {
    grid([flight('CDG', 'Paris', '07:15')]);

    expect(screen.getByText(/^1 flight,/)).toBeTruthy();
  });

  it('reports which one is filtering the board', () => {
    grid([flight('JFK', 'New York', '08:00')], 'JFK');

    expect(cards()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('asks for a filter when one is pressed', async () => {
    const { user, onSelect } = grid([flight('JFK', 'New York', '08:00')]);

    await user.click(cards()[0]);

    expect(onSelect).toHaveBeenCalledWith('JFK');
  });

  it('clears the filter when the same one is pressed again', async () => {
    const { user, onSelect } = grid([flight('JFK', 'New York', '08:00')], 'JFK');

    await user.click(cards()[0]);

    // Pressing the card you are already filtered to is how you get back out.
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('offers a way back only while something is filtered', async () => {
    const { user, onSelect } = grid([flight('JFK', 'New York', '08:00')], 'JFK');

    await user.click(screen.getByRole('button', { name: 'Show all destinations' }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders nothing at all when there is nowhere to show', () => {
    const { container } = render(
      <DestinationGrid flights={[]} selected={null} onSelect={vi.fn()} />,
    );

    // An empty heading over an empty grid is worse than no section.
    expect(container.firstChild).toBeNull();
  });
});
