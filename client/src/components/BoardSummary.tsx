import type { CSSProperties } from 'react';

import { hueFor, toDestinations } from './destinations';

import type { Flight, FlightDirection } from '../models';
import './BoardSummary.css';

interface BoardSummaryProps {
  /** Every flight in the window, before any narrowing. */
  flights: Flight[];
  direction: FlightDirection;
  /** IATA code of the airport the board is showing. */
  airport: string;
  /** The window as the API returned it, airport-local. */
  from: string;
  to: string;
  /** How many are on the board right now, which differs once narrowed. */
  shown: number;
  selected: string | null;
  onSelect: (iata: string | null) => void;
  /** A search is in flight, so the numbers here are about to be wrong. */
  isSearching?: boolean;
}

/** Sliced, not parsed. These are wall clocks at the airport, not instants. */
function clockOf(local: string) {
  return local.slice(11, 16);
}

/**
 * What the window came back with, and where it goes.
 *
 * The counting is done over flights already fetched, so narrowing to one
 * destination costs nothing. Asking the API again to rearrange cards that are
 * already on screen would spend one of six hundred monthly units on data we
 * are holding.
 */
export default function BoardSummary({
  flights,
  direction,
  airport,
  from,
  to,
  shown,
  selected,
  onSelect,
  isSearching = false,
}: BoardSummaryProps) {
  const destinations = toDestinations(flights);
  const noun = direction === 'departure' ? 'departures' : 'arrivals';

  return (
    <section className="summary" aria-label="What is on the board">
      <span className="summary__eyebrow">02 | Where today goes</span>

      <div>
        <p className="summary__count">
          {/* Two dashes rather than a stale number: the count on screen
              belongs to the search that is being replaced. */}
          <span className="summary__number tabular">{isSearching ? '--' : shown}</span>
          <span className="summary__of">
            {selected ? (
              <>
                of {flights.length} {noun}, to <span className="tabular">{selected}</span>
              </>
            ) : (
              <>
                {noun} at <span className="tabular">{airport}</span>
              </>
            )}
          </span>
        </p>

        <p className="summary__window">
          <span className="tabular">{clockOf(from)}</span> to{' '}
          <span className="tabular">{clockOf(to)}</span> local
        </p>
      </div>

      {destinations.length > 0 && (
        <div className="summary__chips">
          {destinations.map((destination) => {
            const on = selected === destination.iata;

            return (
              <button
                key={destination.iata}
                type="button"
                className={on ? 'chip chip--on' : 'chip'}
                style={{ '--chip-hue': hueFor(destination.iata) } as CSSProperties}
                aria-pressed={on}
                /* Spelled out rather than assembled from the spans below.
                   The accessible name is computed by trimming each element,
                   so a visually hidden name beside the code is announced as
                   one run-together word however it is spaced. */
                aria-label={`${destination.iata} ${destination.name}, ${destination.count} flights`}
                /* Pressing the chosen one again is how you get the whole
                   board back, so there is no separate clear button. */
                onClick={() => onSelect(on ? null : destination.iata)}
              >
                <span className="chip__code tabular">{destination.iata}</span>
                <span className="chip__count tabular">{destination.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
