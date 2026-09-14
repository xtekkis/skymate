import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import FlightDetail from './FlightDetail';
import type { Flight } from '../models';

const flight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 'BA 117-2026-09-01T08:00:00Z',
  number: 'BA 117',
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-01T08:00:00Z',
  scheduledLocal: '2026-09-01T09:00+01:00',
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
  ...overrides,
});

/** The two ends of the route, as a reader would hear them. */
const ends = () => [...document.querySelectorAll('.detail__end')].map((end) => end.textContent ?? '');

function show(overrides: Partial<Flight> = {}, onClose = vi.fn()) {
  const view = render(
    <MemoryRouter>
      <FlightDetail flight={flight(overrides)} airport="LHR" onClose={onClose} />
    </MemoryRouter>,
  );

  return { ...view, onClose };
}

describe('what the panel says', () => {
  it('is named by the flight it is showing', () => {
    show();

    expect(screen.getByRole('dialog', { name: 'BA 117' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'BA 117' })).toBeTruthy();
    expect(screen.getByText('British Airways')).toBeTruthy();
  });

  it('runs a departure from this airport to the other one', () => {
    show();

    const [from, to] = ends();
    expect(from).toContain('LHR');
    expect(to).toContain('JFK');
  });

  it('runs an arrival the other way round', () => {
    show({ direction: 'arrival' });

    const [from, to] = ends();
    expect(from).toContain('JFK');
    expect(to).toContain('LHR');
  });

  it('says which end is which, since the plane between them is not read out', () => {
    show();

    // Without these a screen reader hears "LHR JFK" and has to guess.
    const [from, to] = ends();
    expect(from.startsWith('From')).toBe(true);
    expect(to.startsWith('To')).toBe(true);
  });

  it('links to the flight page for what the board does not carry', () => {
    show();

    const link = screen.getByRole('link', { name: /Full flight details/ });
    // The date is the airport's own, read off the local string.
    expect(link.getAttribute('href')).toBe('/flight/BA%20117?date=2026-09-01');
  });
});

describe('closing it', () => {
  it('closes on the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = show();

    await user.click(screen.getByRole('button', { name: 'Close flight' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const { onClose } = show();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores every other key', () => {
    const { onClose } = show();

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening for Escape once it is gone', () => {
    const { onClose, unmount } = show();
    unmount();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('where focus goes', () => {
  it('moves into the panel when it opens', () => {
    show();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close flight' }));
  });

  it('goes back to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = show();
    unmount();

    // Otherwise a keyboard reader is dropped at the top of the page, forty
    // cards from where they were.
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('the facts', () => {
  /** A tile's value, found by its label. */
  function fact(label: string) {
    const term = screen.getByText(label, { selector: 'dt' });
    return term.nextElementSibling as HTMLElement;
  }

  it('shows the scheduled time off the airport clock', () => {
    show();

    expect(fact('Scheduled').textContent).toBe('09:00');
  });

  it('reads a revised time as two facts rather than two numbers', () => {
    show({ revisedLocal: '2026-09-01T09:40+01:00' });

    // "09:00 09:40" on its own is the one thing nobody can afford to misread.
    expect(fact('Scheduled').textContent).toBe('Scheduled 09:00, revised to 09:40');
  });

  it('does not announce a revision that never happened', () => {
    show({ revisedLocal: '2026-09-01T09:00+01:00' });

    expect(fact('Scheduled').textContent).toBe('09:00');
  });

  it('says the status in words and gives it its tone', () => {
    show({ status: 'Delayed' });

    expect(fact('Status').textContent).toBe('Delayed');
    expect(fact('Status').className).toContain('fact__value--warn');
  });

  it('names the terminal the way the board does', () => {
    show({ terminal: '5' });

    expect(fact('Terminal').textContent).toBe('T5');
  });

  it('keeps a tile for a gate that has not been published', () => {
    show({ gate: undefined });

    // Gates publish close to departure. A tile that vanished would read as a
    // layout fault rather than as a fact about the flight.
    expect(fact('Gate').textContent).toBe('Not published');
  });

  it('shows the aircraft, which the board does carry', () => {
    show({ aircraft: 'Boeing 777-300ER' });

    expect(fact('Aircraft').textContent).toBe('Boeing 777-300ER');
  });

  it('shows a check in desk for a departure', () => {
    show({ checkInDesk: '12' });

    expect(fact('Check in').textContent).toBe('Desk 12');
  });

  it('has no check in for an arrival, whose desk was at the other end', () => {
    show({ direction: 'arrival', checkInDesk: '12' });

    expect(screen.queryByText('Check in', { selector: 'dt' })).toBeNull();
  });

  it('shows nothing the schedule does not carry', () => {
    show();

    // The design had a block time here. There is no such field.
    expect(screen.queryByText(/block time/i)).toBeNull();
  });
});

describe('the progress', () => {
  const stages = () =>
    within(screen.getByRole('region', { name: 'Progress' })).queryAllByRole('listitem');

  it('is a section a screen reader can jump to', () => {
    show();

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeTruthy();
  });

  it('says which stages are done in words, not only in colour', () => {
    show({ status: 'Boarding' });

    const [checkIn, boarding, gate] = stages();
    expect(checkIn.textContent).toContain('done');
    expect(boarding.textContent).toContain('done');
    expect(gate.textContent).toContain('not yet');
  });

  it('marks where the flight is now', () => {
    show({ status: 'Boarding' });

    const current = stages().filter((stage) => stage.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Boarding');
  });

  it('puts the real departure time on the last stage', () => {
    show({ status: 'Expected', revisedLocal: '2026-09-01T09:40+01:00' });

    expect(stages().at(-1)?.textContent).toContain('scheduled 09:00, revised to 09:40');
  });

  it('shows no time beside boarding or the gate', () => {
    show({ status: 'GateClosed' });

    const [checkIn, boarding, gate] = stages();
    for (const stage of [checkIn, boarding, gate]) {
      expect(stage.textContent).not.toMatch(/\d{2}:\d{2}/);
    }
  });

  it('says a cancelled flight is cancelled instead of listing stages', () => {
    show({ status: 'Canceled' });

    const region = screen.getByRole('region', { name: 'Progress' });
    expect(region.textContent).toContain('Cancelled');
    expect(stages()).toHaveLength(0);
  });
});
