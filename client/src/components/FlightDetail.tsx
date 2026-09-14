import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AirplaneLanding, AirplaneTakeoff, ArrowRight, X } from '@phosphor-icons/react';

import type { Flight } from '../models';
import { STATUS_LABEL, STATUS_TONE } from './flightStatus';
import { progressOf } from './flightProgress';
import { localTime, revisedTime } from './flightTimes';
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
  const progressId = useId();
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

  const scheduled = localTime(flight.scheduledLocal);
  const revised = revisedTime(flight);
  const progress = progressOf(flight);

  /*
   * Only what the board actually carries. The design this comes from had a
   * block time here, which the schedule does not include, so the tile went to
   * the aircraft instead, which it does.
   *
   * A missing value keeps its tile and says so. Gates publish close to
   * departure, so a flight hours out genuinely has none, and a tile that
   * vanished would read as a layout fault rather than as a fact.
   *
   * Check in is a departures thing: an arrival's desk was at the other end.
   */
  const facts: { label: string; value: string | null }[] = [
    { label: 'Terminal', value: flight.terminal ? `T${flight.terminal}` : null },
    { label: 'Gate', value: flight.gate ?? null },
    ...(outbound
      ? [{ label: 'Check in', value: flight.checkInDesk ? `Desk ${flight.checkInDesk}` : null }]
      : []),
    { label: 'Aircraft', value: flight.aircraft ?? null },
  ];

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

      <dl className="detail__facts">
        <div className="fact">
          <dt className="fact__label">Scheduled</dt>
          <dd className="fact__value tabular">
            {/* The same two facts the card reads out, for the same reason. */}
            {revised && <span className="visually-hidden">Scheduled </span>}
            <span className={revised ? 'fact__was' : undefined}>{scheduled}</span>
            {revised && (
              <>
                <span className="visually-hidden">, revised to </span>
                <span className="fact__revised">{revised}</span>
              </>
            )}
          </dd>
        </div>

        <div className="fact">
          <dt className="fact__label">Status</dt>
          <dd className={`fact__value fact__value--${STATUS_TONE[flight.status]}`}>
            {STATUS_LABEL[flight.status]}
          </dd>
        </div>

        {facts.map((fact) => (
          <div className="fact" key={fact.label}>
            <dt className="fact__label">{fact.label}</dt>
            <dd className={fact.value ? 'fact__value' : 'fact__value fact__value--missing'}>
              {fact.value ?? 'Not published'}
            </dd>
          </div>
        ))}
      </dl>

      <section className="progress" aria-labelledby={progressId}>
        <h3 className="progress__title" id={progressId}>
          Progress
        </h3>

        {progress.kind === 'stopped' ? (
          /* Said outright. A row of unlit stages would read as "not started
             yet" for a flight that is never going to start. */
          <p className={`progress__stopped progress__stopped--${progress.tone}`}>
            {progress.label}
          </p>
        ) : (
          <ol className="progress__steps">
            {progress.steps.map((step, index) => (
              <li
                key={step.label}
                className={step.reached ? 'step step--reached' : 'step'}
                aria-current={index === progress.current ? 'step' : undefined}
              >
                <span className="step__dot" aria-hidden="true" />

                <span className="step__label">
                  {step.label}
                  {/* The dot is the only visible sign, and it is colour. */}
                  <span className="visually-hidden">{step.reached ? ', done' : ', not yet'}</span>
                </span>

                {step.time && (
                  <span className="step__time tabular">
                    {step.time.revised && <span className="visually-hidden">scheduled </span>}
                    <span className={step.time.revised ? 'fact__was' : undefined}>
                      {step.time.scheduled}
                    </span>
                    {step.time.revised && (
                      <>
                        <span className="visually-hidden">, revised to </span>
                        <span className="fact__revised">{step.time.revised}</span>
                      </>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Link className="detail__more" to={detailHref(flight)}>
        Full flight details
        <ArrowRight size={16} weight="bold" aria-hidden="true" />
      </Link>
    </aside>
  );
}
