import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';

import type { CountryGroup } from '../lib/countries';

import './controls.css';
import './CountryPicker.css';

interface CountryPickerProps {
  /** Busiest first, as toCountries orders them. */
  countries: CountryGroup[];
  value: string | null;
  onChange: (code: string) => void;
}

/**
 * How much room the list wants, which decides whether it opens downward.
 *
 * Eight rows and its padding. Kept here rather than measured, because the
 * measurement would have to happen after the list is on the page, which is
 * one frame after it has already opened in the wrong direction.
 */
const LIST_H = 296;

/**
 * Which country's flights the board is showing.
 *
 * A listbox of our own rather than a select. A native one hands its list to
 * the operating system, which draws it in its own colours, at its own size,
 * with its own corners, and opens it wherever it likes: on a long list that
 * means a full-height grey menu over the page, opening upward. None of that
 * is reachable from CSS. This is, at the cost of the keyboard behaviour that
 * a select would have given for free, which is why it is all here.
 */
export default function CountryPicker({ countries, value, onChange }: CountryPickerProps) {
  const id = useId();
  const listId = `${id}-list`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const chosen = countries.findIndex((country) => country.code === value);
  const current = countries[chosen] ?? countries[0];

  /*
   * Opens downward unless the room below is short and the room above is
   * better. A list that always flipped up would cover the search it sits
   * under; one that never flipped would run off the bottom of a phone.
   */
  function show() {
    const box = buttonRef.current?.getBoundingClientRect();

    if (box) {
      const below = window.innerHeight - box.bottom;
      setUp(below < LIST_H && box.top > below);
    }

    setActive(chosen === -1 ? 0 : chosen);
    setOpen(true);
  }

  // The chosen one is often far down a list of forty, and a list that opens
  // at the top makes the reader hunt for where they already are.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function choose(index: number) {
    const country = countries[index];
    setOpen(false);
    buttonRef.current?.focus();
    if (country && country.code !== value) onChange(country.code);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      // Space and Enter are the button's own doing; these are the two that
      // would otherwise scroll the page behind a closed control.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        show();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        setActive((at) => Math.min(countries.length - 1, at + 1));
        break;
      case 'ArrowUp':
        setActive((at) => Math.max(0, at - 1));
        break;
      case 'Home':
        setActive(0);
        break;
      case 'End':
        setActive(countries.length - 1);
        break;
      case 'Enter':
      case ' ':
        choose(active);
        break;
      case 'Escape':
        setOpen(false);
        break;
      case 'Tab':
        // Leaving the control settles it rather than abandoning it open.
        setOpen(false);
        return;
      default:
        return;
    }

    event.preventDefault();
  }

  // Nothing to choose between, so nothing to show.
  if (countries.length === 0) return null;

  return (
    <div className="picker field">
      <label className="field__label" htmlFor={id}>
        Showing flights to
      </label>

      <div className="picker__control" ref={wrapRef}>
        <button
          type="button"
          id={id}
          ref={buttonRef}
          className="input picker__button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKeyDown}
        >
          <span className="picker__value">
            {current.name} ({current.count})
          </span>
          <CaretDown className="picker__caret" size={14} weight="bold" aria-hidden="true" />
        </button>

        {open && (
          <ul
            className={up ? 'picker__list picker__list--up' : 'picker__list'}
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label="Showing flights to"
            // Keeps focus on the button, so the list cannot close before a
            // click has landed on an option.
            onMouseDown={(event) => event.preventDefault()}
          >
            {countries.map((country, index) => (
              <li
                key={country.code}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === chosen}
                className={
                  index === active ? 'picker__option picker__option--active' : 'picker__option'
                }
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="picker__tick" aria-hidden="true">
                  {index === chosen && <Check size={13} weight="bold" />}
                </span>
                <span className="picker__name">{country.name}</span>
                <span className="picker__count tabular">{country.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
