import { useRef, useState, type FormEvent } from 'react';
import { CaretDown, CircleNotch, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';

import AirportInput from './AirportInput';
import { todayLocal } from './boardGeometry';
import { paramsFor, queryFrom, WINDOWS } from './searchQuery';

import type { FlightDirection, SearchParams } from '../models';
import './controls.css';
import './SearchCard.css';

interface SearchCardProps {
  onSearch: (params: SearchParams) => void;
  /** Restores the fields from a shared link or a back navigation. */
  initial?: SearchParams | null;
  /** Owned by the page, since the page owns the request. */
  isSearching?: boolean;
}

type FieldName = 'airport' | 'date' | 'time';
type Errors = Partial<Record<FieldName, string>>;

const DIRECTIONS: { value: FlightDirection; label: string }[] = [
  { value: 'departure', label: 'Departures' },
  { value: 'arrival', label: 'Arrivals' },
];

function validate(values: { airport: string; date: string; time: string }): Errors {
  const errors: Errors = {};

  // The picker only ever commits a code it chose, so the single failure left
  // is not having chosen one.
  if (!values.airport.trim()) errors.airport = 'Choose an airport from the list.';
  if (!values.date) errors.date = 'Choose a date.';
  if (!values.time) errors.time = 'Choose a start time.';

  return errors;
}

/**
 * The board's controls, built for a column rather than a row.
 *
 * The wide form this replaces set its column count from a viewport media
 * query, so in a 366px sidebar on a large screen it still laid itself out in
 * six columns: labels overlapping, inputs twenty pixels wide. Fields stack
 * here because the sidebar is narrow, not because the window is.
 */
export default function SearchCard({ onSearch, isSearching = false, initial }: SearchCardProps) {
  const restored = queryFrom(initial);

  const [airport, setAirport] = useState(restored?.airport ?? '');
  const [direction, setDirection] = useState<FlightDirection>(restored?.direction ?? 'departure');
  const [date, setDate] = useState(restored?.date ?? todayLocal);
  const [time, setTime] = useState(restored?.time ?? '08:00');
  const [windowHours, setWindowHours] = useState<number>(restored?.windowHours ?? 12);
  const [errors, setErrors] = useState<Errors>({});

  const airportRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const refs = { airport: airportRef, date: dateRef, time: timeRef };

  const values = { airport, date, time };

  /** Validates on blur, so an error never appears while the field is still being typed. */
  function handleBlur(field: FieldName) {
    const next = validate(values);
    setErrors((current) => ({ ...current, [field]: next[field] }));
  }

  /** Once a field is showing an error, re-check it as the user types so it clears on fix. */
  function revalidate(field: FieldName, patch: Partial<typeof values>) {
    if (!errors[field]) return;
    const next = validate({ ...values, ...patch });
    setErrors((current) => ({ ...current, [field]: next[field] }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found = validate(values);
    setErrors(found);

    const firstInvalid = (['airport', 'date', 'time'] as FieldName[]).find((field) => found[field]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    onSearch(paramsFor({ airport, direction, date, time, windowHours }));
  }

  function inputClass(field: FieldName, extra = '') {
    return ['search__input', extra, errors[field] ? 'search__input--invalid' : '']
      .filter(Boolean)
      .join(' ');
  }

  return (
    <form className="searchcard" onSubmit={handleSubmit} noValidate>
      <span className="searchcard__eyebrow">01 | Search</span>

      <AirportInput
        value={airport}
        onSelect={(iata) => {
          setAirport(iata);
          revalidate('airport', { airport: iata });
        }}
        error={errors.airport}
        onBlur={() => handleBlur('airport')}
        inputRef={airportRef}
      />

      <fieldset className="search__field">
        <legend className="search__label">Showing</legend>
        <div className="segmented">
          {DIRECTIONS.map(({ value, label }) => (
            <label
              key={value}
              className={
                direction === value
                  ? 'segmented__option segmented__option--on'
                  : 'segmented__option'
              }
            >
              <input
                className="segmented__input"
                type="radio"
                name="board-direction"
                value={value}
                checked={direction === value}
                onChange={() => setDirection(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* The time is narrower than the date because a time is narrower. */}
      <div className="searchcard__when">
        <div className="search__field">
          <label className="search__label" htmlFor="board-date">
            Date
          </label>
          <input
            id="board-date"
            ref={refs.date}
            className={inputClass('date')}
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              revalidate('date', { date: event.target.value });
            }}
            onBlur={() => handleBlur('date')}
            required
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? 'board-date-error' : undefined}
          />
          {errors.date && (
            <p className="search__error" id="board-date-error" role="alert">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {errors.date}
            </p>
          )}
        </div>

        <div className="search__field">
          <label className="search__label" htmlFor="board-time">
            From
          </label>
          <input
            id="board-time"
            ref={refs.time}
            className={inputClass('time', 'tabular')}
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              revalidate('time', { time: event.target.value });
            }}
            onBlur={() => handleBlur('time')}
            required
            aria-invalid={Boolean(errors.time)}
            aria-describedby={errors.time ? 'board-time-error' : undefined}
          />
          {errors.time && (
            <p className="search__error" id="board-time-error" role="alert">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {errors.time}
            </p>
          )}
        </div>
      </div>

      <div className="search__field">
        <label className="search__label" htmlFor="board-window">
          Window
        </label>
        <div className="searchcard__select">
          <select
            id="board-window"
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
          <CaretDown
            className="searchcard__caret"
            size={14}
            weight="bold"
            aria-hidden="true"
          />
        </div>
      </div>

      <button className="search__submit searchcard__submit" type="submit" disabled={isSearching}>
        {isSearching ? (
          <>
            <CircleNotch className="search__spinner" size={18} weight="bold" aria-hidden="true" />
            Searching
          </>
        ) : (
          <>
            <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
            Search
          </>
        )}
      </button>
    </form>
  );
}
