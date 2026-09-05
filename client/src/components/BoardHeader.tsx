import { useEffect, useState } from 'react';

import type { FlightDirection } from '../models';
import './BoardHeader.css';

interface BoardHeaderProps {
  /** IATA code of the airport the board is showing. */
  airport: string;
  direction: FlightDirection;
}

/** The board is a clock face as much as a list, so it keeps step with one. */
const TICK_MS = 20_000;

function localClock(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * The board's chrome.
 *
 * Not the site header: there is nowhere else to go from here, so it carries no
 * navigation. What it carries instead is the two things you need to trust a
 * board, which are the time it is now and which board you are looking at.
 */
export default function BoardHeader({ airport, direction }: BoardHeaderProps) {
  const [clock, setClock] = useState(localClock);

  useEffect(() => {
    // Twenty seconds, not sixty: a minute-long interval drifts against the
    // minute it is displaying and can sit a full minute stale.
    const timer = window.setInterval(() => setClock(localClock()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="masthead">
      <div className="masthead__side">
        <span className="masthead__brand">Skymate</span>

        <span className="masthead__label">
          <span className="masthead__dot" aria-hidden="true" />
          Board live
        </span>
      </div>

      <div className="masthead__side">
        <time className="masthead__clock tabular" dateTime={clock}>
          {clock}
        </time>

        <span className="masthead__rule" aria-hidden="true" />

        <span className="masthead__label">
          <span className="tabular">{airport}</span>
          {' · '}
          {direction === 'departure' ? 'departures' : 'arrivals'}
        </span>
      </div>
    </header>
  );
}
