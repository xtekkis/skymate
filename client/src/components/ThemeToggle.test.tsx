import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ThemeToggle from './ThemeToggle';

const root = document.documentElement;

/** Reports what the operating system is set to, which jsdom cannot answer. */
function systemPrefersDark(dark: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: dark,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

/**
 * fireEvent rather than userEvent: these tests run on fake timers to watch the
 * fade class come off, and userEvent's own internal delay never resolves
 * against a clock nobody is advancing.
 */
function toggle() {
  render(<ThemeToggle />);
  return screen.getByRole('button');
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  root.removeAttribute('data-theme');
  root.classList.remove('theme-shifting');
  systemPrefersDark(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('switching theme', () => {
  it('applies the choice and remembers it', () => {
    fireEvent.click(toggle());

    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('skymate-theme')).toBe('dark');
  });

  it('names the action rather than the state', () => {
    const button = toggle();

    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
    fireEvent.click(button);
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('follows the system until someone actually chooses', () => {
    systemPrefersDark(true);
    const button = toggle();

    // No click, so nothing is stored and nothing is forced onto the document.
    expect(localStorage.getItem('skymate-theme')).toBeNull();
    expect(root.getAttribute('data-theme')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });
});

describe('the cross-fade', () => {
  it('is on for the swap', () => {
    fireEvent.click(toggle());

    // Without it every surface repaints on one frame, which dark to light is a
    // full screen white flash.
    expect(root.classList.contains('theme-shifting')).toBe(true);
  });

  it('comes back off', () => {
    fireEvent.click(toggle());
    vi.advanceTimersByTime(240);

    // Left on, it would put a transition behind every hover in the app.
    expect(root.classList.contains('theme-shifting')).toBe(false);
  });

  it('is not stranded by a second click landing mid-fade', () => {
    const button = toggle();

    fireEvent.click(button);
    vi.advanceTimersByTime(200);
    fireEvent.click(button);

    // The first click's timer must not strip the class out from under the
    // second, leaving the rest of that fade as a cut.
    vi.advanceTimersByTime(100);
    expect(root.classList.contains('theme-shifting')).toBe(true);

    vi.advanceTimersByTime(240);
    expect(root.classList.contains('theme-shifting')).toBe(false);
  });
});
