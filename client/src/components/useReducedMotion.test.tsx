import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useReducedMotion } from './useReducedMotion';

const original = window.matchMedia;
let asked: string[] = [];

afterEach(() => {
  window.matchMedia = original;
  asked = [];
});

/** Answers yes to one exact query and no to everything else. */
function only(matching: string) {
  asked = [];

  window.matchMedia = ((query: string) => {
    asked.push(query);

    return {
      matches: query === matching,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

function Probe() {
  return <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;
}

describe('asking whether to move', () => {
  it('asks the query that means less movement', () => {
    only('(prefers-reduced-motion: reduce)');

    render(<Probe />);

    expect(screen.getByText('reduced')).toBeTruthy();
  });

  it('is not the opposite query wearing the same name', () => {
    // "no-preference" is a different question with the opposite answer, and
    // it contains the word "reduce" nowhere, which is what makes the two easy
    // to swap without noticing.
    only('(prefers-reduced-motion: no-preference)');

    render(<Probe />);

    expect(screen.getByText('full')).toBeTruthy();
    expect(asked).not.toContain('(prefers-reduced-motion: no-preference)');
  });
});
