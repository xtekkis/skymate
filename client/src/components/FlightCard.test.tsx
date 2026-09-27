import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FlightCard from './FlightCard';
import type { Flight } from '../models';

const flight = (over: Partial<Flight> = {}): Flight => ({
  id: 'BA117@2026-09-04T07:45:00Z',
  number: 'BA 117',
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-04T07:45:00Z',
  scheduledLocal: '2026-09-04T08:45+01:00',
  status: 'Expected',
  terminal: '4',
  gate: 'A15',
  isCargo: false,
  isCodeshare: false,
  ...over,
});

const card = (over: Partial<Flight> = {}, props: Partial<Parameters<typeof FlightCard>[0]> = {}) => {
  const onOpen = vi.fn();
  render(<FlightCard flight={flight(over)} onOpen={onOpen} {...props} />);
  return { onOpen, user: userEvent.setup(), button: screen.getByRole('button') };
};

describe('what the card shows', () => {
  it('carries the time, the number and where it goes', () => {
    card();

    expect(screen.getByText('08:45')).toBeTruthy();
    expect(screen.getByText('BA 117')).toBeTruthy();
    expect(screen.getByText('JFK')).toBeTruthy();
    expect(screen.getByText('New York')).toBeTruthy();
  });

  it('reads the time off the airport clock rather than parsing it', () => {
    // Written with a +01:00 offset. Anything that parsed it would show 07:45
    // to a reader in London and something else again in Athens.
    card({ scheduledLocal: '2026-09-04T08:45+01:00' });

    expect(screen.getByText('08:45')).toBeTruthy();
  });

  it('falls back to the airport name when it has no city', () => {
    card({ counterpart: { iata: 'JFK', name: 'John F Kennedy' } });

    expect(screen.getByText('John F Kennedy')).toBeTruthy();
  });

  it('says the status in words', () => {
    card({ status: 'GateClosed' });

    expect(screen.getByText('Gate closed')).toBeTruthy();
  });
});

describe('a flight that has moved', () => {
  const delayed = { revisedLocal: '2026-09-04T09:25+01:00', status: 'Delayed' as const };

  it('shows both times, the old one struck through', () => {
    const { button } = card(delayed);

    expect(button.querySelector('.card__time--was')?.textContent).toBe('08:45');
    expect(screen.getByText('09:25')).toBeTruthy();
  });

  it('reads them out as two separate facts', () => {
    card(delayed);

    // "08:45 09:25" spoken as a run of digits is the one thing on this card
    // nobody can afford to misread.
    expect(screen.getByText(/Scheduled/)).toBeTruthy();
    expect(screen.getByText(/revised to/)).toBeTruthy();
  });

  it('says nothing extra when the time has not changed', () => {
    const { button } = card({ revisedLocal: '2026-09-04T08:45+01:00' });

    // A revision to the same minute is not a revision.
    expect(button.querySelector('.card__time--was')).toBeNull();
    expect(screen.queryByText(/revised to/)).toBeNull();
  });
});

describe('where to stand', () => {
  it('shows the terminal and the gate together', () => {
    card();

    expect(screen.getByText('T4 · A15')).toBeTruthy();
  });

  it('shows whichever one it has', () => {
    card({ gate: undefined });
    expect(screen.getByText('T4')).toBeTruthy();
  });

  it('says the gate is not published rather than leaving a gap', () => {
    card({ terminal: undefined, gate: undefined });

    // Gates publish close to departure, so a flight hours out genuinely has
    // none. The row stays and it does not invent one.
    expect(screen.getByText('Gate not published')).toBeTruthy();
  });
});

describe('the state it is in', () => {
  it('marks the one whose panel is open', () => {
    const { button } = card({}, { selected: true });

    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.className).toContain('card--selected');
  });

  it('claims nothing when it is not the open one', () => {
    const { button } = card();

    expect(button.getAttribute('aria-current')).toBeNull();
  });

  it('dims a cancelled flight rather than dropping it', () => {
    const { button } = card({ status: 'Canceled' });

    // Someone standing in the terminal needs to see that it is gone.
    expect(button.className).toContain('card--cancelled');
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });
});

describe('opening it', () => {
  it('is a real button, so a keyboard can reach it', async () => {
    const { user, onOpen } = card();

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('hands back the flight it was given', async () => {
    const { user, onOpen, button } = card();

    await user.click(button);

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ number: 'BA 117' }));
  });
});

describe('a flight whose far end has been checked', () => {
  const landed = {
    status: 'Arrived' as const,
    time: '11:52',
    kind: 'Revised' as const,
    airport: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
  };

  it('says it arrived rather than that it departed', () => {
    render(<FlightCard flight={flight({ status: 'Departed' })} onOpen={vi.fn()} arrival={landed} />);

    // Departed on a flight that landed two hours ago is the older and
    // smaller truth of the two.
    expect(screen.getByText('Arrived')).toBeTruthy();
    expect(screen.queryByText('Departed')).toBeNull();
  });

  it('says where and when it got there', () => {
    render(
      <FlightCard
        flight={flight({ status: 'Departed', terminal: '5', gate: 'A15' })}
        onOpen={vi.fn()}
        arrival={landed}
      />,
    );

    // The gate it left from is history once it has landed somewhere else.
    expect(screen.getByText(/JFK 11:52/)).toBeTruthy();
    expect(screen.queryByText(/A15/)).toBeNull();
  });

  it('keeps the gate while it is still on its way', () => {
    render(
      <FlightCard
        flight={flight({ status: 'Departed', terminal: '5', gate: 'A15' })}
        onOpen={vi.fn()}
        arrival={{ ...landed, status: 'EnRoute' }}
      />,
    );

    expect(screen.getByText('En route')).toBeTruthy();
    expect(screen.getByText(/A15/)).toBeTruthy();
  });

  it('is unchanged when nobody has asked', () => {
    render(<FlightCard flight={flight({ status: 'Departed', gate: 'A15' })} onOpen={vi.fn()} />);

    expect(screen.getByText('Departed')).toBeTruthy();
    expect(screen.getByText(/A15/)).toBeTruthy();
  });
});
