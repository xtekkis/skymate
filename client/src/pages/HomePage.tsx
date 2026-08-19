import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AirplaneTilt, WarningCircle } from '@phosphor-icons/react';

import FlightList from '../components/FlightList';
import SearchForm from '../components/SearchForm';
import type { SearchParams } from '../models';
import { messageFromError, searchFlights, type FlightSearchResponse } from '../services/api';
import './HomePage.css';

type Phase = 'idle' | 'loading' | 'error' | 'done';

const SKELETON_ROWS = 6;

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<FlightSearchResponse | null>(null);
  const [error, setError] = useState('');

  /** Guards against a slow first search landing after a faster second one. */
  const latestRequest = useRef(0);

  async function handleSearch(params: SearchParams) {
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
      setError(messageFromError(caught));
      setPhase('error');
    }
  }

  return (
    <motion.main
      className="page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1>Flight schedules</h1>
      <p className="page__lead">
        Live departures and arrivals for any airport, with status, terminal and aircraft.
      </p>

      <SearchForm onSearch={handleSearch} />

      <div className="results" aria-live="polite" aria-busy={phase === 'loading'}>
        {phase === 'loading' && (
          <>
            <p className="visually-hidden">Searching flights</p>
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
          </>
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
