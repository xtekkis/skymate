import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library registers its own cleanup only when Vitest globals are on,
// and they are off here. Without this the next test would open on the previous
// test's DOM, and getByRole would find two of everything.
afterEach(cleanup);

/*
 * jsdom implements no media queries at all, so window.matchMedia is simply
 * absent and anything reading prefers-color-scheme throws on mount. Reporting
 * "no match" is enough here: what the theme toggle does with the answer is its
 * own behaviour, and belongs in its own test rather than in every render.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/*
 * jsdom does no layout, so Element.scrollIntoView does not exist. Anything that
 * keeps a view pinned to its newest content calls it, and would throw on mount.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/*
 * jsdom has no layout, so it ships no ResizeObserver either. Anything that
 * reacts to an element changing size constructs one on mount and throws
 * without it. Observing nothing is correct here: sizes never change.
 */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
