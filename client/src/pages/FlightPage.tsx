import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Broadcast, WarningCircle } from '@phosphor-icons/react';

import type { FlightEndpoint, FlightStatus, TrackedFlight } from '../models';
import { getFlightByNumber, messageFromError } from '../services/api';
import './FlightPage.css';

type Phase = 'loading' | 'ready' | 'error';

const STATUS_LABEL: Record<FlightStatus, string> = {
  Unknown: 'Unknown',
  Expected: 'Expected',
  CheckIn: 'Check in',
  Boarding: 'Boarding',
  GateClosed: 'Gate closed',
  Departed: 'Departed',
  EnRoute: 'En route',
  Approaching: 'Approaching',
  Arrived: 'Arrived',
  Delayed: 'Delayed',
  Diverted: 'Diverted',
  Canceled: 'Cancelled',
};

const STATUS_TONE: Record<FlightStatus, string> = {
  Unknown: 'muted',
  Expected: 'info',
  CheckIn: 'info',
  Boarding: 'ok',
  GateClosed: 'warn',
  Departed: 'muted',
  EnRoute: 'muted',
  Approaching: 'ok',
  Arrived: 'ok',
  Delayed: 'warn',
  Diverted: 'warn',
  Canceled: 'danger',
};

/** Read straight off the local string: parsing would re-render in the browser's zone. */
function clock(iso?: string) {
  return iso ? iso.slice(11, 16) : null;
}

function day(iso?: string) {
  return iso ? iso.slice(0, 10) : null;
}

/**
 * The time that actually matters, and what kind of time it is. A revision is
 * the airline changing the schedule; a prediction is AeroDataBox estimating.
 * Those deserve different words.
 */
function currentTime(end: FlightEndpoint) {
  if (end.revisedLocal) return { iso: end.revisedLocal, kind: 'Revised' as const };
  if (end.predictedLocal) return { iso: end.predictedLocal, kind: 'Predicted' as const };
  return { iso: end.scheduledLocal, kind: null };
}

function airportLabel(end: FlightEndpoint) {
  const { shortName, municipality, name } = end.airport;
  if (shortName && municipality) return `${shortName}, ${municipality}`;
  return name;
}

function Endpoint({ end, role }: { end: FlightEndpoint; role: 'Departure' | 'Arrival' }) {
  const current = currentTime(end);
  const time = clock(current.iso);
  const changed = Boolean(current.kind) && current.iso !== end.scheduledLocal;

  const details = [
    end.terminal && `Terminal ${end.terminal}`,
    end.gate && `Gate ${end.gate}`,
    end.checkInDesk && `Desk ${end.checkInDesk}`,
    end.baggageBelt && `Belt ${end.baggageBelt}`,
  ].filter(Boolean) as string[];

  return (
    <div className="endpoint">
      <p className="endpoint__role">{role}</p>
      <p className="endpoint__code tabular">{end.airport.iata || '???'}</p>
      <p className="endpoint__place">{airportLabel(end)}</p>

      {time ? (
        <>
          <p className="endpoint__time tabular">{time}</p>
          {changed && (
            <p className="endpoint__was">
              <span className="endpoint__struck tabular">{clock(end.scheduledLocal)}</span>
              {current.kind}
            </p>
          )}
          <p className="endpoint__date tabular">{day(current.iso)}</p>
        </>
      ) : (
        <p className="endpoint__pending">Not published yet</p>
      )}

      {details.length > 0 && <p className="endpoint__details">{details.join(' · ')}</p>}
    </div>
  );
}

export default function FlightPage() {
  const { number = '' } = useParams();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') ?? undefined;

  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState<Phase>('loading');
  const [flights, setFlights] = useState<TrackedFlight[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPhase('loading');
    // A previous failure has nothing to say about the flight being loaded now.
    setError(null);

    getFlightByNumber(number, date)
      .then((response) => {
        if (!active) return;
        setFlights(response.flights);
        setPhase('ready');
      })
      .catch((caught) => {
        if (!active) return;
        setError(messageFromError(caught));
        setPhase('error');
      });

    return () => {
      active = false;
    };
  }, [number, date]);

  const label = number.toUpperCase();

  /**
   * One sentence for a screen reader, matching what the search page does. The
   * skeleton and the cards are shapes on a screen; without this, loading a
   * flight and finding one are the same silence.
   */
  const status =
    phase === 'loading'
      ? `Loading flight ${label}`
      : phase === 'ready'
        ? flights.length === 0
          ? `No flight found for ${label}`
          : `${flights.length} ${flights.length === 1 ? 'flight' : 'flights'} found for ${label}`
        : '';

  /** React Router marks the first entry "default", so that means no in-app history. */
  function goBack() {
    if (location.key === 'default') navigate('/');
    else navigate(-1);
  }

  return (
    <main id="main" tabIndex={-1} className="page flight">
      <button type="button" className="flight__back" onClick={goBack}>
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        Back
      </button>

      {/* Always mounted: a live region that arrives with its own text is
          often missed, there having been nothing there to change. */}
      <p className="visually-hidden" role="status">
        {status}
      </p>

      {phase === 'loading' && (
        <div className="flight__card flight__skeleton" aria-busy="true" aria-label="Loading flight">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--row" />
          <span className="skeleton skeleton--row" />
        </div>
      )}

      {phase === 'error' && (
        <div className="flight__notice flight__notice--error" role="alert">
          <WarningCircle size={18} weight="fill" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {phase === 'ready' && flights.length === 0 && (
        <div className="flight__notice">
          <p>
            No flight found for <span className="tabular">{label}</span>
            {date ? ` on ${date}` : ''}.
          </p>
          <p className="flight__noticeHint">
            Check the number, or try a different date. Schedules are usually published a few
            months ahead.
          </p>
        </div>
      )}

      {phase === 'ready' &&
        flights.map((flight) => (
          <motion.article
            key={flight.id}
            className="flight__card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flight__head">
              <div>
                <h1 className="flight__number tabular">{flight.number}</h1>
                <p className="flight__airline">{flight.airline}</p>
              </div>

              <div className="flight__flags">
                <span className={`badge badge--${STATUS_TONE[flight.status]}`}>
                  {STATUS_LABEL[flight.status]}
                </span>
                {flight.departure.isLive && (
                  <span className="flight__live" title="Tracking the aircraft, not just the timetable">
                    <Broadcast size={13} weight="bold" aria-hidden="true" />
                    Live
                  </span>
                )}
              </div>
            </header>

            <div className="flight__journey">
              <Endpoint end={flight.departure} role="Departure" />
              <ArrowRight className="flight__arrow" size={20} weight="bold" aria-hidden="true" />
              <Endpoint end={flight.arrival} role="Arrival" />
            </div>

            {(flight.aircraft || flight.lastUpdated) && (
              <footer className="flight__foot">
                {flight.aircraft && <span>{flight.aircraft}</span>}
                {flight.lastUpdated && (
                  <span className="tabular">Updated {flight.lastUpdated.slice(0, 16).replace('T', ' ')} UTC</span>
                )}
              </footer>
            )}
          </motion.article>
        ))}
    </main>
  );
}
