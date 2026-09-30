import { useEffect, useRef, useState } from 'react';

import type { SearchParams } from '../models';
import { errorStatus, messageFromError, searchFlights, type FlightSearchResponse } from '../services/api';

export type SearchPhase = 'idle' | 'loading' | 'done' | 'error';

const IATA = /^[A-Z]{3}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** The same shape the server refuses, checked before spending a request on it. */
function isSearchable({ airport, fromLocal, toLocal }: SearchParams) {
  return IATA.test(airport) && LOCAL_DATETIME.test(fromLocal) && LOCAL_DATETIME.test(toLocal);
}

/**
 * One window of flights, from the API.
 *
 * Takes the four values rather than an object so the effect can depend on
 * them: a caller building its params inline would otherwise hand over a new
 * object every render and this would search forever.
 *
 * Says nothing about toasts or skeletons. It reports what happened and the
 * status behind a failure, and the page decides what that looks like.
 */
export function useFlightSearch({ airport, direction, fromLocal, toLocal }: SearchParams) {
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [result, setResult] = useState<FlightSearchResponse | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<number | undefined>(undefined);

  /** Guards against a slow first search landing after a faster second one. */
  const latest = useRef(0);

  useEffect(() => {
    const params = { airport, direction, fromLocal, toLocal };

    if (!isSearchable(params)) {
      setPhase('idle');
      setResult(null);
      return;
    }

    const id = ++latest.current;
    setPhase('loading');
    setError('');
    setStatus(undefined);

    /*
     * The old flights go now, not when the new ones arrive.
     *
     * The masthead names the airport from the URL, which changes the moment
     * Search is pressed, so holding the last window a moment longer puts one
     * airport's cards under another airport's name. On a failure it is worse:
     * the board sits there indefinitely, saying CDG and showing LHR, with the
     * only hint a small notice in the sidebar.
     */
    setResult(null);

    searchFlights(params)
      .then((data) => {
        if (id !== latest.current) return;
        setResult(data);
        setPhase('done');
      })
      .catch((caught: unknown) => {
        if (id !== latest.current) return;
        setError(messageFromError(caught));
        setStatus(errorStatus(caught));
        setPhase('error');
      });
  }, [airport, direction, fromLocal, toLocal]);

  return { phase, result, error, status };
}
