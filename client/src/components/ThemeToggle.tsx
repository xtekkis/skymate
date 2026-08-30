import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

import './ThemeToggle.css';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'skymate-theme';

/** Matches --duration-theme. Long enough to cover the fade, then get out. */
const SHIFT_MS = 240;

function readTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const shiftTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(shiftTimer.current), []);

  /**
   * Writes to storage only on an explicit click, so a user who never touches
   * the toggle keeps following their system preference.
   */
  function choose() {
    const root = document.documentElement;

    // The class is what turns the cross-fade on, and it comes straight back
    // off. An app that transitions colour permanently is a sluggish one.
    root.classList.add('theme-shifting');
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);

    // Restarted rather than stacked, so double clicking does not strand the
    // class on an early timer.
    window.clearTimeout(shiftTimer.current);
    shiftTimer.current = window.setTimeout(() => {
      root.classList.remove('theme-shifting');
    }, SHIFT_MS);
  }

  return (
    <button type="button" className="theme-toggle" onClick={choose} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  );
}
