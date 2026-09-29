import { type CSSProperties } from 'react';

import type { Flight } from '../models';
import { STATUS_LABEL, STATUS_TONE, isBoarding } from '../lib/flightStatus';
import type { Arrival } from '../lib/flightArrival';
import { localTime, revisedTime } from '../lib/flightTimes';
import './FlightCard.css';

interface FlightCardProps {
  flight: Flight;
  /** The one whose detail panel is open. */
  selected?: boolean;
  onOpen: (flight: Flight) => void;
  /** Where the board puts it. Left unset, the card is simply full width. */
  style?: CSSProperties;
  /**
   * The far end, once somebody has asked about it.
   *
   * A departures board says a flight left and stops there. This is the answer
   * to the one question it cannot answer, and only flights that were actually
   * asked about have one.
   */
  arrival?: Arrival | null;
}

/**
 * Terminal and gate, and what to say when there is neither.
 *
 * Gates publish close to departure, so a flight hours out genuinely has none.
 * Saying so is the house rule: the row stays, and it does not invent a gate.
 */
function whereToGo(flight: Flight) {
  const terminal = flight.terminal ? `T${flight.terminal}` : '';
  const gate = flight.gate ? `${terminal ? '' : 'Gate '}${flight.gate}` : '';

  if (terminal && gate) return `${terminal} · ${gate}`;
  return terminal || gate || 'Gate not published';
}

/**
 * One flight, as it sits on the board.
 *
 * Full width by default rather than positioned: the board places it on the
 * time axis, and the narrow layout stacks the same card in a list.
 */
export default function FlightCard({
  flight,
  selected = false,
  onOpen,
  style,
  arrival = null,
}: FlightCardProps) {
  const scheduled = localTime(flight.scheduledLocal);
  const revised = revisedTime(flight);

  /*
   * The status of the whole journey wins over the board's own once it is
   * known. "Departed" on a flight that landed two hours ago is the older and
   * smaller truth of the two.
   */
  const status = arrival?.status ?? flight.status;

  const classes = ['card'];
  if (selected) classes.push('card--selected');
  if (flight.status === 'Canceled') classes.push('card--cancelled');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      style={style}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(flight)}
    >
      <span className="card__row">
        <span className="card__times tabular">
          {/*
            Struck through and read aloud as two separate facts. "08:45 09:25"
            on its own is the one thing on this card nobody can afford to
            misread.
          */}
          {revised && <span className="visually-hidden">Scheduled </span>}
          <span className={revised ? 'card__time card__time--was' : 'card__time'}>{scheduled}</span>
          {revised && (
            <>
              <span className="visually-hidden">, revised to </span>
              <span className="card__revised">{revised}</span>
            </>
          )}
        </span>

        <span className="card__number tabular">{flight.number}</span>
      </span>

      <span className="card__row card__row--where">
        <span className="card__iata tabular">{flight.counterpart.iata}</span>
        <span className="card__city">
          {flight.counterpart.municipality || flight.counterpart.name}
        </span>
      </span>

      <span className="card__row">
        <span className={`badge badge--${STATUS_TONE[status]}`}>
          <span
            className={isBoarding(status) ? 'badge__dot badge__dot--live' : 'badge__dot'}
            aria-hidden="true"
          />
          {STATUS_LABEL[status]}
        </span>

        {/* Once it has landed the gate it left from is history, and where and
            when it got there is the thing worth the same space. */}
        {arrival && arrival.status === 'Arrived' ? (
          <span className="card__meta tabular">
            <span className="visually-hidden">at </span>
            {arrival.airport.iata} {arrival.time}
          </span>
        ) : (
          <span className="card__meta tabular">{whereToGo(flight)}</span>
        )}
      </span>
    </button>
  );
}
