import { useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

import './ThemeToggle.css';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'skymate-theme';

function readTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  /**
   * Writes to storage only on an explicit click, so a user who never touches
   * the toggle keeps following their system preference.
   */
  function choose() {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }

  return (
    <button type="button" className="theme-toggle" onClick={choose} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  );
}
