import { useState, type FormEvent } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

import type { FlightDirection, SearchParams } from '../models';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
}

/** AeroDataBox caps a query window at 12 hours. */
const WINDOWS = [4, 8, 12] as const;

const DIRECTIONS: { value: FlightDirection; label: string }[] = [
  { value: 'departure', label: 'Departures' },
  { value: 'arrival', label: 'Arrivals' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Adds hours to a local date and time, rolling the date over when needed. */
function addHours(date: string, time: string, hours: number) {
  const end = new Date(`${date}T${time}:00`);
  end.setHours(end.getHours() + hours);
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export default function SearchForm({ onSearch }: SearchFormProps) {
  const [airport, setAirport] = useState('');
  const [direction, setDirection] = useState<FlightDirection>('departure');
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState('08:00');
  const [windowHours, setWindowHours] = useState<number>(12);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    onSearch({
      airport: airport.trim().toUpperCase(),
      direction,
      fromLocal: `${date}T${time}`,
      toLocal: addHours(date, time, windowHours),
    });
  }

  return (
    <form className="search" onSubmit={handleSubmit}>
      <div className="search__grid">
        <div className="search__field search__field--airport">
          <label className="search__label" htmlFor="search-airport">
            Airport
          </label>
          <input
            id="search-airport"
            className="search__input search__input--code tabular"
            value={airport}
            onChange={(event) => setAirport(event.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="search__hint">3-letter IATA code, for example LHR</p>
        </div>

        <fieldset className="search__field search__field--direction">
          <legend className="search__label">Showing</legend>
          <div className="segmented">
            {DIRECTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={
                  direction === value ? 'segmented__option segmented__option--on' : 'segmented__option'
                }
              >
                <input
                  className="segmented__input"
                  type="radio"
                  name="direction"
                  value={value}
                  checked={direction === value}
                  onChange={() => setDirection(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="search__field">
          <label className="search__label" htmlFor="search-date">
            Date
          </label>
          <input
            id="search-date"
            className="search__input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>

        <div className="search__field">
          <label className="search__label" htmlFor="search-time">
            From
          </label>
          <input
            id="search-time"
            className="search__input tabular"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
          />
        </div>

        <div className="search__field">
          <label className="search__label" htmlFor="search-window">
            Window
          </label>
          <select
            id="search-window"
            className="search__input"
            value={windowHours}
            onChange={(event) => setWindowHours(Number(event.target.value))}
          >
            {WINDOWS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours
              </option>
            ))}
          </select>
        </div>

        <button className="search__submit" type="submit">
          <MagnifyingGlass size={18} weight="bold" />
          Search
        </button>
      </div>
    </form>
  );
}
