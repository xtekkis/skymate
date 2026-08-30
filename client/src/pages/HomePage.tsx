import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AirplaneTilt, WarningCircle } from '@phosphor-icons/react';

import FlightList from '../components/FlightList';
import SearchForm from '../components/SearchForm';
import type { SearchParams } from '../models';
import { useToast } from '../components/toastContext';
import {
  errorStatus,
  messageFromError,
  searchFlights,
  type FlightSearchResponse,
} from '../services/api';
import './HomePage.css';

type Phase = 'idle' | 'loading' | 'error' | 'done';

/** Statuses that describe the whole app rather than this one request. */
const SITE_WIDE = new Set([429, 503]);


const SKELETON_ROWS = 6;

/**
 * The search lives in the query string rather than in component state.
 *
 * That is what makes going back from a flight restore the results instead of
 * an empty form, and it survives a refresh and makes a search shareable, which
 * memory alone cannot do.
 */
function readSearch(params: URLSearchParams): SearchParams | null {
  const airport = (params.get('airport') ?? '').toUpperCase();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const direction = params.get('direction') === 'arrival' ? 'arrival' : 'departure';

  // A half written URL should show the empty form, not an error.
  if (!/^[A-Z]{3}$/.test(airport)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(to)) return null;

  return { airport, direction, fromLocal: from, toLocal: to };
}

export default function HomePage() {
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<FlightSearchResponse | null>(null);
  const [error, setError] = useState('');

  /** Guards against a slow first search landing after a faster second one. */
  const latestRequest = useRef(0);

  // Reparsed rather than stored, so back, forward and a pasted link all take
  // the same path into the search.
  const search = useMemo(() => readSearch(searchParams), [searchParams]);
  const searchKey = search ? `${search.airport}|${search.direction}|${search.fromLocal}|${search.toLocal}` : '';

  const run = useCallback(
    async (params: SearchParams) => {
      const id = ++latestRequest.current;
      setPhase('loading');
      setError('');

      try {
        const data = await searchFlights(params);
        if (id !== latestRequest.current) return;
        setResult(data);
        setPhase('done');
      } catch (caught) {
        if (id !== latestRequest.current) return;

        const message = messageFromError(caught);
        setError(message);
        setPhase('error');

        // A rate limit or a spent allowance is a condition of the site, not a
        // problem with this search, so it is also said out of band.
        if (SITE_WIDE.has(errorStatus(caught) ?? 0)) showToast({ message });
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!search) {
      setPhase('idle');
      setResult(null);
      return;
    }
    void run(search);
    // Keyed on the string, not the object: readSearch returns a new object on
    // every render, and depending on it would re-run the search forever.
  }, [searchKey]);

  /**
   * One sentence describing where the search has got to, for a screen reader.
   *
   * The results block used to be the live region itself, which meant finishing
   * a search read out the entire table, row by row. A reader wants to know the
   * search landed and how many flights there are; the table is then theirs to
   * navigate.
   */
  const status =
    phase === 'loading'
      ? 'Searching flights'
      : phase === 'done' && result
        ? result.count === 0
          ? 'No flights in that window'
          : `${result.count} ${result.direction === 'departure' ? 'departures' : 'arrivals'} at ${result.airport}`
        : '';

  /** Submitting writes the URL. The effect above notices and does the work. */
  function handleSearch(params: SearchParams) {
    setSearchParams({
      airport: params.airport,
      direction: params.direction,
      from: params.fromLocal,
      to: params.toLocal,
    });
  }

  return (
    <motion.main
      id="main"
      tabIndex={-1}
      className="page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1>Flight schedules</h1>
      <p className="page__lead">
        Live departures and arrivals for any airport, with status, terminal and aircraft.
      </p>

      <SearchForm onSearch={handleSearch} isSearching={phase === 'loading'} initial={search} />

      <div className="results" aria-busy={phase === 'loading'}>
        {/* Always mounted. A live region that appears at the same moment as its
            text is often missed, because there was nothing there to change. */}
        <p className="visually-hidden" role="status">
          {status}
        </p>

        {phase === 'loading' && (
          <div className="skeleton" aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <div className="skeleton__row" key={row}>
                <span className="skeleton__bar skeleton__bar--time" />
                <span className="skeleton__bar skeleton__bar--number" />
                <span className="skeleton__bar skeleton__bar--airline" />
                <span className="skeleton__bar skeleton__bar--status" />
              </div>
            ))}
          </div>
        )}

        {phase === 'error' && (
          <div className="notice notice--error" role="alert">
            <WarningCircle size={20} weight="fill" aria-hidden="true" />
            <div>
              <p className="notice__title">Search failed</p>
              <p className="notice__body">{error}</p>
            </div>
          </div>
        )}

        {phase === 'done' && result && result.count === 0 && (
          <div className="notice">
            <AirplaneTilt size={20} weight="fill" aria-hidden="true" />
            <div>
              <p className="notice__title">No flights in that window</p>
              <p className="notice__body">
                Try a longer window, a different time of day, or check the airport code.
              </p>
            </div>
          </div>
        )}

        {phase === 'done' && result && result.count > 0 && (
          <>
            <p className="results__count">
              {result.count} {result.direction === 'departure' ? 'departures' : 'arrivals'} at{' '}
              <span className="tabular">{result.airport}</span>
            </p>
            <FlightList flights={result.flights} direction={result.direction} />
          </>
        )}
      </div>
    </motion.main>
  );
}
