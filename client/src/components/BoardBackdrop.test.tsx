import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BoardBackdrop from './BoardBackdrop';

const original = window.matchMedia;

/** jsdom answers no media query, so a test with a preference has to say so. */
function prefersReduced(reduce: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduce && query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
});

describe('the room the board sits in', () => {
  it('says nothing to a screen reader', () => {
    const { container } = render(<BoardBackdrop />);

    // Five arcs and a field of dots are worth nothing read aloud, and the
    // arcs are an svg, which is announced unless it is told not to be.
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('graphics-document')).toBeNull();
  });

  it('is not a tab stop, at any depth', () => {
    const { container } = render(<BoardBackdrop />);

    // An svg is focusable in some browsers unless focusable="false" says so,
    // and a decoration you can tab into is a decoration in the way.
    for (const node of container.querySelectorAll('*')) {
      expect(node.getAttribute('tabindex')).toBeNull();
    }
    expect(container.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });

  it('draws every route it says it draws', () => {
    const { container } = render(<BoardBackdrop />);

    const drawn = container.querySelectorAll('use');
    expect(drawn).toHaveLength(5);

    // Dashed, or they are five solid lines across the board rather than
    // something that reads as a route.
    for (const route of drawn) expect(route.getAttribute('stroke-dasharray')).toBeTruthy();

    // Every drawn route points at a definition that exists, or it draws
    // nothing at all and the board sits in an empty room.
    for (const route of drawn) {
      const target = route.getAttribute('href')?.slice(1) ?? '';
      expect(container.querySelector(`defs #${target}`)).toBeTruthy();
    }
  });

  it('has all four layers, since each one moves at its own rate later', () => {
    const { container } = render(<BoardBackdrop />);

    expect(container.querySelector('.backdrop__wash')).toBeTruthy();
    expect(container.querySelector('.backdrop__arcs')).toBeTruthy();
    expect(container.querySelector('.backdrop__dots')).toBeTruthy();
    expect(container.querySelector('.backdrop__grain')).toBeTruthy();
  });
});

describe('the lights travelling the routes', () => {
  it('are on the page when movement is welcome', () => {
    prefersReduced(false);
    const { container } = render(<BoardBackdrop />);

    expect(container.querySelectorAll('animateMotion')).toHaveLength(5);
  });

  it('are not on the page at all when it is not', () => {
    prefersReduced(true);
    const { container } = render(<BoardBackdrop />);

    // Not merely paused. This is SMIL, which the stylesheet rule that
    // flattens every animation in the app cannot reach, so the only way to
    // not play it is to not render it.
    expect(container.querySelectorAll('animateMotion')).toHaveLength(0);
  });

  it('leaves no parked specks behind when it drops them', () => {
    prefersReduced(true);
    const { container } = render(<BoardBackdrop />);

    // A light with nothing moving it sits at the start of its route, which
    // reads as five bits of dust rather than as nothing.
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('follows a route that exists', () => {
    prefersReduced(false);
    const { container } = render(<BoardBackdrop />);

    for (const path of container.querySelectorAll('mpath')) {
      const target = path.getAttribute('href')?.slice(1) ?? '';
      expect(container.querySelector(`defs #${target}`)).toBeTruthy();
    }
  });

  it('starts each one part way round, not all five at the gate', () => {
    prefersReduced(false);
    const { container } = render(<BoardBackdrop />);

    const begins = [...container.querySelectorAll('animateMotion')].map((node) =>
      node.getAttribute('begin'),
    );

    expect(new Set(begins).size).toBe(begins.length);
    // Negative, which is how SMIL says "already this far in".
    for (const begin of begins) expect(begin?.startsWith('-')).toBe(true);
  });
});
