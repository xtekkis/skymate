import { NavLink } from 'react-router-dom';

import ThemeToggle from './ThemeToggle';
import './Header.css';

const navItems = [
  { to: '/', label: 'Flights' },
  { to: '/assistant', label: 'Assistant' },
];

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <NavLink to="/" className="header__brand">
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
