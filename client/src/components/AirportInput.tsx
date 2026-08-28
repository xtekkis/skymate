import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import type { Airport } from '../models';
import { searchAirports } from '../services/api';
import './AirportInput.css';

interface AirportInputProps {
  /** The committed IATA code, or empty when nothing is chosen yet. */
  value: string;
  /** Fires with a code on selection, and with '' whenever the choice is undone. */
  onSelect: (iata: string) => void;
  error?: string;
  onBlur?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

export default function AirportInput({
  value,
  onSelect,
  error,
  onBlur,
  inputRef,
}: AirportInputProps) {
  const listId = useId();
  const inputId = useId();
  const noteId = useId();

  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Airport | null>(null);
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const requestRef = useRef(0);

  // A choice cleared from outside, such as a form reset, has to clear here too.
  useEffect(() => {
    if (!value) setChosen(null);
  }, [value]);

  useEffect(() => {
    const term = query.trim();

    if (term.length < MIN_QUERY) {
      setResults([]);
      return;
    }

    // Debounced, so a burst of typing is one request rather than one per key.
    const timer = setTimeout(() => {
      const ticket = ++requestRef.current;

      searchAirports(term)
        .then((airports) => {
          // Ignore a slow response that a newer one has already overtaken.
          if (ticket !== requestRef.current) return;
          setResults(airports);
          setActive(0);
        })
        .catch(() => {
          if (ticket === requestRef.current) setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function choose(airport: Airport) {
    setChosen(airport);
    setQuery(airport.iata);
    setOpen(false);
    onSelect(airport.iata);
  }

  function handleChange(next: string) {
    setQuery(next.slice(0, 40));
    setOpen(true);

    // Typing after choosing undoes the choice, so a half-typed code can never
    // be submitted as though it had been picked from the list.
    if (chosen) {
      setChosen(null);
      onSelect('');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + results.length) % Math.max(results.length, 1));
      return;
    }

    if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && results.length > 0;

  return (
    <div className="search__field airport">
      <label className="search__label" htmlFor={inputId}>
        Airport
      </label>

      <div className="airport__control">
        <input
          id={inputId}
          ref={inputRef}
          className={`search__input search__input--code tabular${error ? ' search__input--invalid' : ''}`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={noteId}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
          setOpen(false);
          onBlur?.();
          }}
        />

        {showList && (
          <ul
            className="airport__list"
            id={listId}
            role="listbox"
            aria-label="Matching airports"
            // Keeps focus in the input, so blur does not close the list before a
            // click has landed on an option.
            onMouseDown={(event) => event.preventDefault()}
          >
            {results.map((airport, index) => (
              <li
                key={airport.iata}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={
                  index === active ? 'airport__option airport__option--active' : 'airport__option'
                }
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(airport)}
              >
                <span className="airport__code tabular">{airport.iata}</span>
                <span className="airport__name">{airport.name}</span>
                <span className="airport__where">
                  {[airport.municipality, airport.countryCode].filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="search__error" id={noteId} role="alert">
          <WarningCircle size={14} weight="fill" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p className="airport__note" id={noteId}>
          {chosen ? chosen.name : 'Type a city or airport name'}
        </p>
      )}
    </div>
  );
}
