import { useId } from 'react';
import { CaretDown } from '@phosphor-icons/react';

import type { CountryGroup } from './countries';

import './controls.css';
import './CountryPicker.css';

interface CountryPickerProps {
  /** Busiest first, as toCountries orders them. */
  countries: CountryGroup[];
  value: string | null;
  onChange: (code: string) => void;
}

/**
 * Which country's flights the board is showing.
 *
 * Twelve hours out of a large airport is five hundred flights, which is more
 * board than anyone can read and more cards than the lanes can hold apart.
 * One country at a time is the cut that keeps the axis legible without a
 * second request: every flight is already here, and this chooses which of
 * them are drawn.
 */
export default function CountryPicker({ countries, value, onChange }: CountryPickerProps) {
  const id = useId();

  // Nothing to choose between, so nothing to show.
  if (countries.length === 0) return null;

  return (
    <div className="picker search__field">
      <label className="search__label" htmlFor={id}>
        Showing flights to
      </label>

      <div className="picker__control">
        <select
          id={id}
          className="search__input"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.count})
            </option>
          ))}
        </select>

        <CaretDown className="picker__caret" size={14} weight="bold" aria-hidden="true" />
      </div>
    </div>
  );
}
