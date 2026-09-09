import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FlightBoard from './FlightBoard';
import { CARD_W, GUTTER, LANE_H, PX_PER_MINUTE } from './boardGeometry';
import type { Flight } from '../models';

/** jsdom answers no media query, so a test that wants motion has to say so. */
function allowMotion(allowed: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      // Matched on no-preference only. Testing for "reduce" would be wrong:
      // "prefers-reduced-motion: no-preference" contains it too.
      matches: allowed === query.includes('no-preference'),
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
const at = (h: number, m = 0) => h * 60 + m;

const flight = (number: string, local: string, over: Partial<Flight> = {}): Flight => ({
  id: number,
  number,
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-04T07:45:00Z',
  scheduledLocal: local,
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
  ...over,
});

const hourly = [
  flight('BA 1', '2026-09-04T08:00+01:00'),
  flight('BA 2', '2026-09-04T09:00+01:00'),
  flight('BA 3', '2026-09-04T10:00+01:00'),
  flight('BA 4', '2026-09-04T11:00+01:00'),
];

function board(flights = hourly, selectedId: string | null = null) {
  const onOpen = vi.fn();
  render(
    <FlightBoard
      flights={flights}
      date="2026-09-04"
      start={at(8)}
      windowHours={4}
      selectedId={selectedId}
      onOpen={onOpen}
    />,
  );
  return { onOpen, user: userEvent.setup() };
}

const cards = () => Array.from(document.querySelectorAll<HTMLElement>('.card'));
const cardFor = (number: string) =>
  screen.getByRole('button', { name: new RegExp(number.replace(' ', '\\s')) });

describe('putting the flights on the axis', () => {
  it('draws one card per flight', () => {
    board();

    expect(cards()).toHaveLength(hourly.length);
  });

  it('places the first card at the gutter', () => {
    board();

    // The window opens at 08:00 and so does this flight.
    expect(cardFor('BA 1').style.left).toBe(`${GUTTER}px`);
  });

  it('places each one by the minute it leaves', () => {
    board();

    // An hour further along the axis, at the board's own scale.
    expect(cardFor('BA 2').style.left).toBe(`${Math.round(60 * PX_PER_MINUTE) + GUTTER}px`);
  });

  it('reads the minute off the airport clock rather than parsing it', () => {
    // Written with a +01:00 offset. Anything that parsed this would place the
    // card somewhere different for a reader in Athens than one in London.
    board([flight('BA 9', '2026-09-04T09:00+01:00')]);

    expect(cardFor('BA 9').style.left).toBe(`${Math.round(60 * PX_PER_MINUTE) + GUTTER}px`);
  });

  it('gives every card the boards own width', () => {
    board();

    for (const card of cards()) expect(card.style.width).toBe(`${CARD_W}px`);
  });
});

describe('stacking them into lanes', () => {
  it('deals them down the lanes rather than piling them in one', () => {
    board();

    const tops = cards().map((card) => card.style.top);

    // Three lanes fit a stage jsdom reports as zero tall, so the fourth card
    // comes back round to the first lane.
    expect(new Set(tops).size).toBe(3);
    expect(tops[0]).toBe(tops[3]);
  });

  it('spaces the lanes by the lane height', () => {
    board();

    const tops = cards().map((card) => Number.parseInt(card.style.top, 10));

    expect(tops[0]).toBe(GUTTER);
    expect(tops[1] - tops[0]).toBe(LANE_H);
  });
});

describe('opening a card', () => {
  it('hands the flight back', async () => {
    const { user, onOpen } = board();

    await user.click(cardFor('BA 2'));

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ number: 'BA 2' }));
  });

  it('marks the one that is open', () => {
    board(hourly, 'BA 3');

    expect(cardFor('BA 3').getAttribute('aria-current')).toBe('true');
    expect(cardFor('BA 1').getAttribute('aria-current')).toBeNull();
  });
});

describe('an empty window', () => {
  it('draws the axis and no cards', () => {
    board([]);

    expect(cards()).toHaveLength(0);
    // The ruler is still there: an empty board is still a board.
    expect(screen.getByLabelText('Flight timeline')).toBeTruthy();
  });
});

describe('the cards arriving', () => {
  it('starts them hidden and ends with every one readable', async () => {
    allowMotion(true);
    board();

    // Proves the entrance actually ran, so the assertion below is not
    // passing because nothing happened.
    expect(cards()[0].style.opacity).toBe('0');

    // The whole risk of animating an entrance: a board that never finishes
    // animating is a board nobody can read.
    await waitFor(
      () => {
        for (const card of cards()) expect(card.style.opacity).toBe('');
      },
      { timeout: 4000 },
    );
  });

  it('hands the cards back where this component put them', async () => {
    allowMotion(true);
    board();

    await waitFor(() => {
      for (const card of cards()) expect(card.style.transform).toBe('');
    });

    // clearProps takes opacity and transform and nothing else. The position
    // on the time axis is not the animation to clean up after.
    expect(cards()[0].style.left).toBe(`${GUTTER}px`);
    expect(cards()[0].style.top).toBe(`${GUTTER}px`);
  });

  it('sets nothing up at all when motion is unwelcome', () => {
    allowMotion(false);
    board();

    for (const card of cards()) {
      expect(card.style.opacity).toBe('');
      expect(card.style.transform).toBe('');
    }
  });
});

describe('the present moment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const nowLine = () => document.querySelector<HTMLElement>('.now');

  function boardOn(date: string, clock: string) {
    vi.setSystemTime(new Date(clock));
    render(
      <FlightBoard
        flights={[]}
        date={date}
        start={at(8)}
        windowHours={4}
        onOpen={vi.fn()}
      />,
    );
  }

  it('draws a line at the minute it is', () => {
    boardOn('2026-09-09', '2026-09-09T09:30:00');

    expect(nowLine()).toBeTruthy();
    expect(nowLine()!.style.left).toBe(`${Math.round(90 * PX_PER_MINUTE) + GUTTER}px`);
  });

  it('says what the line is', () => {
    boardOn('2026-09-09', '2026-09-09T09:30:00');

    expect(screen.getByText('Now')).toBeTruthy();
  });

  it('draws nothing on a board showing another day', () => {
    boardOn('2026-09-10', '2026-09-09T09:30:00');

    // A board showing tomorrow has no present on it.
    expect(nowLine()).toBeNull();
  });

  it('draws nothing once the window has closed', () => {
    boardOn('2026-09-09', '2026-09-09T23:30:00');

    // Parked off the edge at some large negative number is how a line ends
    // up half visible on a board it has nothing to say about.
    expect(nowLine()).toBeNull();
  });

  it('keeps up with the clock on its own', () => {
    boardOn('2026-09-09', '2026-09-09T09:30:00');
    const before = nowLine()!.style.left;

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    // A board left open must not quietly start lying about where now is.
    expect(nowLine()!.style.left).not.toBe(before);
  });
});
