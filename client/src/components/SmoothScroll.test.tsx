import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SmoothScroll from './SmoothScroll';

/** jsdom answers no media query, so a test that wants motion has to say so. */
function allowMotion(allowed: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      // Matched on no-preference only. Testing for 'reduce' would be wrong:
      // the string "prefers-reduced-motion: no-preference" contains it too,
      // so both queries would report the same answer.
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
  document.documentElement.className = '';
});

/** Lenis marks the document while it is driving the scroll. */
const isSmoothing = () => document.documentElement.classList.contains('lenis');

describe('smooth scrolling', () => {
  it('takes over the scroll when motion is welcome', () => {
    allowMotion(true);
    render(<SmoothScroll />);

    expect(isSmoothing()).toBe(true);
  });

  it('does not start at all when motion is unwelcome', () => {
    allowMotion(false);
    render(<SmoothScroll />);

    // Reinterpreting someone's scrollbar is motion. Turning it down is not
    // enough; it should never have been theirs to begin with.
    expect(isSmoothing()).toBe(false);
  });

  it('hands the scroll back when it unmounts', () => {
    allowMotion(true);
    const { unmount } = render(<SmoothScroll />);

    expect(isSmoothing()).toBe(true);
    unmount();

    // A listener left on the document outlives the component that added it,
    // and this one intercepts every wheel event on the page.
    expect(isSmoothing()).toBe(false);
  });

  it('renders nothing', () => {
    allowMotion(true);
    const { container } = render(<SmoothScroll />);

    expect(container.firstChild).toBeNull();
  });
});
