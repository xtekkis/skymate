import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FlightBoard from './FlightBoard';
import { CARD_W, GUTTER, LANE_H, PX_PER_MINUTE } from './boardGeometry';
import type { Flight } from '../models';

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
