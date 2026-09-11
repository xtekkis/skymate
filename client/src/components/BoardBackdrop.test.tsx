import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BoardBackdrop from './BoardBackdrop';

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

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(5);

    // Dashed, or they are five solid lines across the board rather than
    // something that reads as a route.
    for (const path of paths) expect(path.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('has all four layers, since each one moves at its own rate later', () => {
    const { container } = render(<BoardBackdrop />);

    expect(container.querySelector('.backdrop__wash')).toBeTruthy();
    expect(container.querySelector('.backdrop__arcs')).toBeTruthy();
    expect(container.querySelector('.backdrop__dots')).toBeTruthy();
    expect(container.querySelector('.backdrop__grain')).toBeTruthy();
  });
});
