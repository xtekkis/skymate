import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import StoryBlocks from './StoryBlocks';

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

const blocks = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.story__block'));

describe('what it says', () => {
  it('says three things and stops', () => {
    allowMotion(false);
    render(<StoryBlocks />);

    expect(screen.getAllByRole('heading')).toHaveLength(3);
  });

  it('claims only things this app actually does', () => {
    allowMotion(false);
    render(<StoryBlocks />);

    // Each of these is checkable against the code, which is the point: copy
    // that would fit any flight site would be worse than no copy.
    expect(screen.getByText(/struck through beside the new one/)).toBeTruthy();
    expect(screen.getByText(/no access to flight data/)).toBeTruthy();
    expect(screen.getByText(/light or dark/)).toBeTruthy();
  });
});

describe('revealing on scroll', () => {
  it('leaves the text alone entirely when motion is unwelcome', () => {
    allowMotion(false);
    render(<StoryBlocks />);

    for (const block of blocks()) {
      expect(block.style.opacity).toBe('');
      expect(block.style.transform).toBe('');
    }
  });

  it('never leaves a block invisible', async () => {
    allowMotion(true);
    render(<StoryBlocks />);

    // The from state is applied at once, before any scrolling. That is what
    // makes the assertion below matter: a trigger that never fires would leave
    // the text at zero forever, and the page would look empty rather than
    // broken. Proving it starts hidden is proving the risk is real.
    for (const block of blocks()) expect(block.style.opacity).toBe('0');

    /*
     * The failure this guards against is the worst one a scroll reveal has: a
     * trigger that never fires leaves the text at zero opacity forever, and the
     * page looks empty rather than broken. Whatever happens, every block ends
     * readable.
     */
    await waitFor(
      () => {
        for (const block of blocks()) {
          expect(block.style.opacity === '' || Number(block.style.opacity) > 0.99).toBe(true);
        }
      },
      { timeout: 4000 },
    );
  });
});
