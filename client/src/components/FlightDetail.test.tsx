import { fireEvent, render, screen } from '@testing-library/react';
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
