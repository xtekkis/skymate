import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AirplaneLanding, AirplaneTakeoff, ArrowRight, X } from '@phosphor-icons/react';

import type { Flight } from '../models';
import './FlightDetail.css';

interface FlightDetailProps {
  flight: Flight;
  /** IATA code of the airport the board is showing. */
  airport: string;
  onClose: () => void;
}

/**
 * The flight's own page, which is where everything the panel cannot know
 * lives: that page asks the API for the whole journey, and this one does not.
 */
function detailHref(flight: Flight) {
  const date = flight.scheduledLocal?.slice(0, 10) ?? flight.scheduledTime.slice(0, 10);
  return `/flight/${encodeURIComponent(flight.number)}?date=${date}`;
}

/**
 * One flight, opened over the board.
 *
 * Built entirely from the card that was pressed. The board already fetched
 * this flight, so asking the API again to show it would spend one of six
 * hundred monthly units on data that is already on screen. What the board
 * does not carry, the full page links to.
 *
 * Not modal: the board stays usable behind it, and pressing another card
 * swaps what is shown rather than having to close this first.
 */
export default function FlightDetail({ flight, airport, onClose }: FlightDetailProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const outbound = flight.direction === 'departure';
  const other = flight.counterpart;

  // The board's airport is one end, the card's counterpart the other.
  const from = outbound ? { code: airport } : { code: other.iata, city: other.municipality };
  const to = outbound ? { code: other.iata, city: other.municipality } : { code: airport };

  /*
   * Focus goes into the panel when it opens and back to whatever opened it
   * when it closes. Without the return, closing drops a keyboard reader at the
   * top of the page, forty cards away from where they were.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    // No check that the opener is still on the page. A new search can have
    // replaced that card, and focusing an element that has left the page is
    // already a silent no-op, so guarding it would change nothing.
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const Plane = outbound ? AirplaneTakeoff : AirplaneLanding;

  return (
    <aside className="detail" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="detail__head">
        <div>
          <span className="detail__airline">{flight.airline}</span>
          <h2 className="detail__number tabular" id={titleId}>
            {flight.number}
          </h2>
        </div>

        <button
          type="button"
          className="detail__close"
          ref={closeRef}
          onClick={onClose}
          aria-label="Close flight"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      </header>

      <div className="detail__route">
        <div className="detail__end">
          <p className="detail__code tabular">
            <span className="visually-hidden">From </span>
            {from.code}
          </p>
          {from.city && <p className="detail__city">{from.city}</p>}
        </div>

        <div className="detail__path" aria-hidden="true">
          <span className="detail__line" />
          <Plane size={18} weight="fill" />
        </div>

        <div className="detail__end detail__end--to">
          <p className="detail__code tabular">
            <span className="visually-hidden">To </span>
            {to.code}
          </p>
          {to.city && <p className="detail__city">{to.city}</p>}
        </div>
      </div>

      <Link className="detail__more" to={detailHref(flight)}>
        Full flight details
        <ArrowRight size={16} weight="bold" aria-hidden="true" />
      </Link>
    </aside>
  );
}
