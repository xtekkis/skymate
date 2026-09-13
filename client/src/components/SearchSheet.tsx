import { useId, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

import SearchCard from './SearchCard';

import type { FlightDirection, SearchParams } from '../models';
import './SearchSheet.css';

interface SearchSheetProps {
  /** The code the board is showing, or empty before anything is chosen. */
  airport: string;
  direction: FlightDirection;
  onSearch: (params: SearchParams) => void;
  initial?: SearchParams | null;
  isSearching?: boolean;
}

/**
 * The search controls, folded away until they are wanted.
 *
 * On a phone the full card is most of the first screen, which puts the
 * flights below the fold on a page whose entire job is showing flights. Open
 * to begin with only when there is nothing to show yet, since a reader who
 * arrived on an empty board came here to fill it in.
 *
 * The controls themselves are the same component the sidebar uses. A second
 * copy of a form is a second copy of its validation.
 */
export default function SearchSheet({
  airport,
  direction,
  onSearch,
  initial,
  isSearching = false,
}: SearchSheetProps) {
  const panelId = useId();
  const [open, setOpen] = useState(() => !airport);

  const noun = direction === 'departure' ? 'departures' : 'arrivals';

  return (
    <div className="sheet">
      <button
        type="button"
        className="sheet__summary"
        aria-expanded={open}
        aria-controls={panelId}
        /*
         * Spelled out rather than read off the spans below. The accessible
         * name is computed by trimming each element, so "LHR" and
         * "departures" in neighbouring spans are announced as one word.
         *
         * It also has to say what pressing it does. "LHR departures" names
         * what is on the board, not what the button is for.
         */
        aria-label={airport ? `${airport} ${noun}, change search` : 'Choose an airport'}
        onClick={() => setOpen((was) => !was)}
      >
        {open ? (
          <CaretUp size={16} weight="bold" aria-hidden="true" />
        ) : (
          <CaretDown size={16} weight="bold" aria-hidden="true" />
        )}

        {airport ? (
          <>
            <span className="sheet__code tabular">{airport}</span>
            <span className="sheet__what">{noun}</span>
          </>
        ) : (
          <span className="sheet__what">Choose an airport</span>
        )}
      </button>

      {/*
       * Unmounted rather than hidden. Leaving a form in the page means its
       * fields stay in the tab order behind a summary that says it is closed.
       */}
      {open && (
        <div className="sheet__panel" id={panelId}>
          <SearchCard
            bare
            onSearch={(params) => {
              // Folding away on submit, so the results it just asked for are
              // the next thing on screen rather than the form that asked.
              setOpen(false);
              onSearch(params);
            }}
            initial={initial}
            isSearching={isSearching}
          />
        </div>
      )}
    </div>
  );
}
