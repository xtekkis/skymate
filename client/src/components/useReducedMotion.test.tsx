import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useReducedMotion } from './useReducedMotion';

const listeners = new Set<(event: MediaQueryListEvent) => void>();
const original = window.matchMedia;

/** jsdom answers no media query, so a test that has a preference has to say so. */
function prefers(reduce: boolean) {
  listeners.clear();

  window.matchMedia = ((query: string) =>
    ({
      // Matched on "reduce" only. Testing for "no-preference" would be wrong:
      // it is a different query with the opposite answer.
      matches: reduce && query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
        listeners.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
  listeners.clear();
});

function Probe() {
  return <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;
}

describe('asking whether to move', () => {
  it('says no movement when that is the preference', () => {
    prefers(true);
    render(<Probe />);

    expect(screen.getByText('reduced')).toBeTruthy();
  });

  it('says movement is fine otherwise', () => {
    prefers(false);
    render(<Probe />);

    expect(screen.getByText('full')).toBeTruthy();
  });

  it('keeps up when the preference changes while the page is open', () => {
    prefers(false);
    render(<Probe />);

    act(() => {
      for (const fn of listeners) fn({ matches: true } as MediaQueryListEvent);
    });

    // Changing the system setting should not need a reload to take effect.
    expect(screen.getByText('reduced')).toBeTruthy();
  });

  it('stops listening once it is gone', () => {
    prefers(false);
    const view = render(<Probe />);

    expect(listeners.size).toBe(1);
    view.unmount();

    expect(listeners.size).toBe(0);
  });

  it('answers plainly where there is no matchMedia at all', () => {
    // @ts-expect-error deliberately removing it, which is what an old
    // environment looks like from in here.
    window.matchMedia = undefined;

    // A environment that was never told about media queries is not a reader
    // asking for anything, so this must answer rather than throw.
    expect(() => render(<Probe />)).not.toThrow();
    expect(screen.getByText('full')).toBeTruthy();
  });
});
