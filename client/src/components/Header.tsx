import { NavLink } from 'react-router-dom';

import ThemeToggle from './ThemeToggle';
import './Header.css';

const navItems = [{ to: '/', label: 'Flights' }];

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        {/*
          * Out of the tab order on purpose. It goes where the Flights link
          * beside it goes, so tabbing through it reaches the same page twice
          * before anything new. Still a link for the mouse, and still reachable
          * in a screen reader's own browse mode.
          */}
        <NavLink to="/" className="header__brand" tabIndex={-1}>
          Skymate
        </NavLink>

        <nav className="header__nav" aria-label="Primary">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'header__link header__link--active' : 'header__link'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
