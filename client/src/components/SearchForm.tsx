import { useRef, useState, type FormEvent } from 'react';
import { CircleNotch, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';

import type { FlightDirection, SearchParams } from '../models';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  /** Owned by the page, since the page owns the request. */
  isSearching?: boolean;
}

type FieldName = 'airport' | 'date' | 'time';
type Errors = Partial<Record<FieldName, string>>;

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

function validate(values: { airport: string; date: string; time: string }): Errors {
  const errors: Errors = {};
  const airport = values.airport.trim().toUpperCase();

  if (!airport) {
    errors.airport = 'Enter an airport code.';
  } else if (!/^[A-Z]{3}$/.test(airport)) {
    errors.airport = 'Use a 3-letter IATA code, for example LHR.';
  }

  if (!values.date) errors.date = 'Choose a date.';
  if (!values.time) errors.time = 'Choose a start time.';

  return errors;
}

export default function SearchForm({ onSearch, isSearching = false }: SearchFormProps) {
  const [airport, setAirport] = useState('');
  const [direction, setDirection] = useState<FlightDirection>('departure');
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState('08:00');
  const [windowHours, setWindowHours] = useState<number>(12);
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

    onSearch({
      airport: airport.trim().toUpperCase(),
      direction,
      fromLocal: `${date}T${time}`,
      toLocal: addHours(date, time, windowHours),
    });
  }

  function inputClass(field: FieldName, extra = '') {
    return [
      'search__input',
      extra,
      errors[field] ? 'search__input--invalid' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return (
    <form className="search" onSubmit={handleSubmit} noValidate>
      <div className="search__grid">
        <div className="search__field search__field--airport">
          <label className="search__label" htmlFor="search-airport">
            Airport
          </label>
          <input
            id="search-airport"
            ref={refs.airport}
            className={inputClass('airport', 'search__input--code tabular')}
            value={airport}
            onChange={(event) => {
              const next = event.target.value.toUpperCase().slice(0, 3);
              setAirport(next);
              revalidate('airport', { airport: next });
            }}
            onBlur={() => handleBlur('airport')}
            maxLength={3}
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={Boolean(errors.airport)}
            aria-describedby="search-airport-note"
          />
          {errors.airport ? (
            <p className="search__error" id="search-airport-note" role="alert">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {errors.airport}
            </p>
          ) : (
            <p className="search__hint" id="search-airport-note">
              3-letter IATA code, for example LHR
            </p>
          )}
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
            aria-describedby={errors.date ? 'search-date-error' : undefined}
          />
          {errors.date && (
            <p className="search__error" id="search-date-error" role="alert">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {errors.date}
            </p>
          )}
        </div>

        <div className="search__field">
          <label className="search__label" htmlFor="search-time">
            From
          </label>
          <input
            id="search-time"
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
            aria-describedby={errors.time ? 'search-time-error' : undefined}
          />
          {errors.time && (
            <p className="search__error" id="search-time-error" role="alert">
              <WarningCircle size={14} weight="fill" aria-hidden="true" />
              {errors.time}
            </p>
          )}
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

        <button className="search__submit" type="submit" disabled={isSearching}>
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
      </div>
    </form>
  );
}
