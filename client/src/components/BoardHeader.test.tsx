import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BoardHeader from './BoardHeader';

/** 21:29 local, whatever zone the test runs in: no Z, so it parses as local. */
const EVENING = new Date('2026-09-04T21:29:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EVENING);
});

afterEach(() => {
  vi.useRealTimers();
});

const clock = () => screen.getByRole('time');

describe('what the bar says', () => {
  it('names the product and the board you are on', () => {
    render(<BoardHeader airport="LHR" direction="departure" />);

    expect(screen.getByText('Skymate')).toBeTruthy();
    expect(screen.getByText(/LHR/)).toBeTruthy();
    expect(screen.getByText(/departures/)).toBeTruthy();
  });

  it('says arrivals when that is what you are looking at', () => {
    render(<BoardHeader airport="CDG" direction="arrival" />);

    expect(screen.getByText(/arrivals/)).toBeTruthy();
    expect(screen.queryByText(/departures/)).toBeNull();
  });

  it('carries no navigation', () => {
    render(<BoardHeader airport="LHR" direction="departure" />);

    // There is nowhere else to go from the board, and a link that only goes
    // back to where you are is a link people click by mistake.
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('the clock', () => {
  it('shows the local time as a machine-readable time', () => {
    render(<BoardHeader airport="LHR" direction="departure" />);

    expect(clock().textContent).toBe('21:29');
    expect(clock().getAttribute('datetime')).toBe('21:29');
  });

  it('keeps itself current without a re-render from outside', () => {
    render(<BoardHeader airport="LHR" direction="departure" />);
    expect(clock().textContent).toBe('21:29');

    act(() => void vi.advanceTimersByTime(60_000));

    // A board whose clock is wrong is worse than a board with no clock.
    expect(clock().textContent).toBe('21:30');
  });

  it('stops ticking when it goes away', () => {
    const { unmount } = render(<BoardHeader airport="LHR" direction="departure" />);

    unmount();

    // An interval left behind outlives the component and keeps calling
    // setState on something that no longer exists.
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the live indicator', () => {
  it('says it in words, not only in colour', () => {
    render(<BoardHeader airport="LHR" direction="departure" />);

    expect(screen.getByText(/Board live/)).toBeTruthy();
  });

  it('hides the dot itself from a screen reader', () => {
    const { container } = render(<BoardHeader airport="LHR" direction="departure" />);

    // The word beside it already carries the meaning; announcing the dot as
    // well would just be saying it twice.
    expect(container.querySelector('.masthead__dot')?.getAttribute('aria-hidden')).toBe('true');
  });
});
