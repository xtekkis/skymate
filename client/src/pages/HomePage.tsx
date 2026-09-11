import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AirplaneTilt, WarningCircle } from '@phosphor-icons/react';

import BoardSummary from '../components/BoardSummary';
import FlightBoard from '../components/FlightBoard';
import SearchCard from '../components/SearchCard';
import { minutesOfLocal, todayLocal } from '../components/boardGeometry';
import { paramsFor, queryFrom, type BoardQuery } from '../components/searchQuery';
import { useFlightSearch } from '../components/useFlightSearch';
import { useToast } from '../components/toastContext';
import type { Flight, SearchParams } from '../models';
import './HomePage.css';

/** Statuses that describe the whole app rather than this one request. */
const SITE_WIDE = new Set([429, 503]);

/**
 * The search lives in the query string rather than in component state.
 *
 * That is what makes going back from a flight restore the board instead of an
 * empty one, and it survives a refresh and makes a search shareable, which
 * memory alone cannot do.
 */
function readSearch(params: URLSearchParams): SearchParams | null {
  const airport = (params.get('airport') ?? '').toUpperCase();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const direction = params.get('direction') === 'arrival' ? 'arrival' : 'departure';

  // A half written URL should show the empty board, not an error.
  if (!/^[A-Z]{3}$/.test(airport)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(to)) return null;

  return { airport, direction, fromLocal: from, toLocal: to };
}

/**
 * What the board shows before anyone has searched.
 *
 * A real date and time, so the ruler has hours on it and the axis is something
 * to look at rather than a blank rectangle. The airport is empty on purpose:
 * that is the field the search hook refuses, so an unsearched board costs
 * nothing.
 */
function emptyBoard(): BoardQuery {
  return { airport: '', direction: 'departure', date: todayLocal(), time: '08:00', windowHours: 12 };
}

/** The number is the real link, so opening a card goes where the number goes. */
function detailHref(flight: Flight) {
  const date = flight.scheduledLocal?.slice(0, 10) ?? flight.scheduledTime.slice(0, 10);
  return `/flight/${encodeURIComponent(flight.number)}?date=${date}`;
}

export default function HomePage() {
  const showToast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * Reparsed rather than stored, so back, forward and a pasted link all take
   * the same path onto the board.
   */
  const search = useMemo(() => readSearch(searchParams), [searchParams]);
  const query = queryFrom(search) ?? emptyBoard();
  const params = paramsFor(query);

  const { phase, result, error, status: httpStatus } = useFlightSearch(params);

  /*
   * The destination the board is narrowed to, if any.
   *
   * Held here rather than in the URL, unlike the search itself. The URL is
   * what the search hook watches, so writing a filter into it would re-run the
   * search on every chip press and spend an AeroDataBox unit to rearrange
   * cards already on screen. This is a view over data we have, not a new query.
   */
  const [destination, setDestination] = useState<string | null>(null);

  // A filter belongs to the results it was chosen from.
  useEffect(() => setDestination(null), [result]);

  const all = result?.flights ?? [];
  const flights = destination
    ? all.filter((flight) => flight.counterpart.iata === destination)
    : all;

  /*
   * What the board takes over from the document while it is on screen.
   *
   * The scroll, because the board fills the window and pans itself, and a page
   * that scrolls as well fights it. And the theme: the board is a dark room
   * with lit cards in it, and its masthead carries no theme toggle, so a
   * reader whose system is set to light would get a white board with no way
   * to change it.
   *
   * Both are undone on the way out, so the flight page keeps its scrollbar and
   * whichever theme the reader actually chose.
   */
  useEffect(() => {
    const html = document.documentElement;
    const chosen = html.getAttribute('data-theme');

    document.body.classList.add('is-board');
    html.setAttribute('data-theme', 'dark');

    return () => {
      document.body.classList.remove('is-board');
      if (chosen === null) html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', chosen);
    };
  }, []);

  useEffect(() => {
    // A rate limit or a spent allowance is a condition of the site, not a
    // problem with this search, so it is also said out of band.
    if (phase === 'error' && SITE_WIDE.has(httpStatus ?? 0)) showToast({ message: error });
  }, [phase, httpStatus, error, showToast]);

  /** One sentence describing where the search has got to, for a screen reader. */
  const announcement =
    phase === 'loading'
      ? 'Searching flights'
      : phase === 'done' && result
        ? result.count === 0
          ? 'No flights in that window'
          : destination
            ? `${flights.length} of ${result.count} ${result.direction === 'departure' ? 'departures' : 'arrivals'}, to ${destination}`
            : `${result.count} ${result.direction === 'departure' ? 'departures' : 'arrivals'} at ${result.airport}`
        : '';

  /** Submitting writes the URL. The hook notices and does the work. */
  function handleSearch(next: SearchParams) {
    setSearchParams({
      airport: next.airport,
      direction: next.direction,
      from: next.fromLocal,
      to: next.toLocal,
    });
  }

  return (
    <main id="main" tabIndex={-1} className="board-page">
      <aside className="board-page__side">
        {/* The board is the page. Its title is owed to a screen reader, not to
            anyone looking at a masthead that already says Skymate. */}
        <h1 className="visually-hidden">Flight board</h1>

        <SearchCard onSearch={handleSearch} isSearching={phase === 'loading'} initial={search} />

        {/* Always mounted. A live region that appears at the same moment as its
            text is often missed, because there was nothing there to change. */}
        <p className="visually-hidden" role="status">
          {announcement}
        </p>

        {phase === 'error' && (
          <div className="notice notice--error" role="alert">
            <WarningCircle size={20} weight="fill" aria-hidden="true" />
            <div>
              <p className="notice__title">Search failed</p>
              <p className="notice__body">{error}</p>
            </div>
          </div>
        )}

        {phase === 'done' && result?.count === 0 && (
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
        {result && result.count > 0 && (
          <BoardSummary
            flights={result.flights}
            direction={result.direction}
            airport={result.airport}
            from={result.from}
            to={result.to}
            shown={flights.length}
            selected={destination}
            onSelect={setDestination}
            isSearching={phase === 'loading'}
          />
        )}
      </aside>

      <FlightBoard
        flights={flights}
        date={query.date}
        start={minutesOfLocal(params.fromLocal)}
        windowHours={query.windowHours}
        onOpen={(flight) => navigate(detailHref(flight))}
      />
    </main>
  );
}
