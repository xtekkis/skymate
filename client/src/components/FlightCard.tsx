import { type CSSProperties } from 'react';

import type { Flight } from '../models';
import { STATUS_LABEL, STATUS_TONE, isBoarding } from './flightStatus';
import { localTime, revisedTime } from './flightTimes';
import './FlightCard.css';

interface FlightCardProps {
  flight: Flight;
  /** The one whose detail panel is open. */
  selected?: boolean;
  onOpen: (flight: Flight) => void;
  /** Where the board puts it. Left unset, the card is simply full width. */
  style?: CSSProperties;
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
export default function FlightCard({ flight, selected = false, onOpen, style }: FlightCardProps) {
  const scheduled = localTime(flight.scheduledLocal);
  const revised = revisedTime(flight);

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
        <span className={`badge badge--${STATUS_TONE[flight.status]}`}>
          <span
            className={isBoarding(flight.status) ? 'badge__dot badge__dot--live' : 'badge__dot'}
            aria-hidden="true"
          />
          {STATUS_LABEL[flight.status]}
        </span>

        <span className="card__meta tabular">{whereToGo(flight)}</span>
      </span>
    </button>
  );
}
