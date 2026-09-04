import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import FlightList from './FlightList';
import type { Flight, FlightDirection } from '../models';

/*
 * A zone nowhere near the airports below. Every time on this board is a wall
 * clock time at the airport, so nothing here may shift with the reader's own
 * clock, and a test running in UTC would never notice if it did.
 */
beforeAll(() => {
  vi.stubEnv('TZ', 'Pacific/Kiritimati');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/** jsdom answers no media query, so a test that wants motion has to say so. */
function allowMotion(allowed: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: allowed && query.includes('no-preference'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const flight = (over: Partial<Flight> = {}): Flight => ({
  id: 'BA117@2026-09-01T07:00:00Z',
  number: 'BA 117',
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-01T07:00:00Z',
  scheduledLocal: '2026-09-01T08:00+01:00',
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
  ...over,
});

function board(flights: Flight[], direction: FlightDirection = 'departure') {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FlightList flights={flights} direction={direction} />} />
        <Route path="/flight/:number" element={<p>detail page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const rows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('the board', () => {
  it('shows a row per flight, in the order given', () => {
    board([flight({ id: 'a', number: 'BA 117' }), flight({ id: 'b', number: 'BA 175' })]);

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('BA 117');
    expect(rows()[1].textContent).toContain('BA 175');
  });

  it('shows the time at the airport, whatever clock the reader is on', () => {
    board([flight({ scheduledLocal: '2026-09-01T08:00+01:00' })]);

    // Reparsed into this test's zone it would read 21:00 the day before.
    expect(within(rows()[0]).getByText('08:00')).toBeTruthy();
  });

  it('shows both times when a flight has been revised', () => {
    board([
      flight({
        scheduledLocal: '2026-09-01T08:00+01:00',
        revisedLocal: '2026-09-01T09:25+01:00',
      }),
    ]);

    expect(within(rows()[0]).getByText('08:00')).toBeTruthy();
    expect(within(rows()[0]).getByText('09:25')).toBeTruthy();
  });

  it('names the far end by what the direction makes it', () => {
    board([flight()], 'arrival');
    expect(screen.getByRole('columnheader', { name: 'From' })).toBeTruthy();
  });

  it('counts itself correctly for a screen reader', () => {
    board([flight()]);

    // One flight, not "1 flights".
    expect(screen.getByText(/1 flight,/)).toBeTruthy();
  });
});

describe('opening a flight', () => {
  it('links the number to the detail page, dated at the airport', () => {
    board([flight({ number: 'BA 117', scheduledLocal: '2026-09-01T08:00+01:00' })]);

    const link = within(rows()[0]).getByRole('link', { name: 'BA 117' });
    expect(link.getAttribute('href')).toBe('/flight/BA%20117?date=2026-09-01');
  });

  it('opens the flight when the row is clicked anywhere', async () => {
    const user = userEvent.setup();
    board([flight()]);

    await user.click(within(rows()[0]).getByText('British Airways'));

    expect(await screen.findByText('detail page')).toBeTruthy();
  });

  it('leaves a click on the link itself to the browser', async () => {
    const user = userEvent.setup();
    board([flight()]);

    // The row handler must stand aside here, or middle-click and open-in-new-tab
    // would be swallowed by a navigate that ignores the modifier keys.
    await user.click(within(rows()[0]).getByRole('link', { name: 'BA 117' }));

    expect(await screen.findByText('detail page')).toBeTruthy();
  });
});

describe('scrolling inside the board', () => {
  it('keeps its own scroll rather than moving the page', () => {
    board([flight()]);

    // Smooth scrolling intercepts the whole document. Without this the board
    // cannot be dragged sideways: the page slides underneath instead.
    const wrap = document.querySelector('.board');
    expect(wrap?.hasAttribute('data-lenis-prevent')).toBe(true);
  });
});

describe('a cancelled flight', () => {
  it('is marked as one rather than only coloured as one', () => {
    board([flight({ status: 'Canceled' })]);

    expect(rows()[0].className).toContain('board__row--cancelled');
    expect(within(rows()[0]).getByText('Cancelled')).toBeTruthy();
  });
});

describe('the rows arriving', () => {
  it('ends with every row visible', async () => {
    allowMotion(true);
    board([flight({ id: 'a' }), flight({ id: 'b' })]);

    // Proves the animation actually ran, so the assertion below is not passing
    // because nothing happened.
    expect(rows()[0].style.opacity).toBe('0');

    // The whole risk of animating an entrance: a board that never finishes
    // animating is a board nobody can read. from() plus clearProps means the
    // rows are handed back to CSS at the end, wearing nothing.
    await waitFor(
      () => {
        for (const row of rows()) expect(row.style.opacity).toBe('');
      },
      { timeout: 4000 },
    );
  });

  it('does not touch the rows at all when motion is unwelcome', () => {
    allowMotion(false);
    board([flight()]);

    // Not "animates faster": nothing is set up, so there is nothing to leave
    // behind if it is interrupted.
    expect(rows()[0].style.opacity).toBe('');
    expect(rows()[0].style.transform).toBe('');
  });
});
