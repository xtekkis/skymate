import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AirplaneTilt, WarningCircle } from '@phosphor-icons/react';

import BoardBackdrop from '../components/BoardBackdrop';
import BoardSummary from '../components/BoardSummary';
import FlightCard from '../components/FlightCard';
import FlightBoard from '../components/FlightBoard';
import SearchCard from '../components/SearchCard';
import SearchSheet from '../components/SearchSheet';
import { minutesOfLocal, todayLocal } from '../components/boardGeometry';
import { paramsFor, queryFrom, type BoardQuery } from '../components/searchQuery';
import { useFlightSearch } from '../components/useFlightSearch';
import { useMediaQuery } from '../components/useMediaQuery';
import { useToast } from '../components/toastContext';
import type { Flight, SearchParams } from '../models';

/**
 * Below this there is no room for a time axis.
 *
 * A board is a surface you move around in, and 366px of controls beside it
 * leaves a phone about forty pixels of window. The same cards go in a list
 * instead, which is a worse way to see a shape and a better way to read one.
 */
const NARROW = '(max-width: 759px)';
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

  const narrow = useMediaQuery(NARROW);
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

  const open = (flight: Flight) => navigate(detailHref(flight));

  /*
   * The parts both layouts show, named once.
   *
   * The wide one stacks them in a sidebar beside the board. The narrow one
   * puts the search across the top as a bar that folds away, because the full
   * card is most of a phone's first screen and the flights are the page.
   */
  const announce = (
    // Always mounted. A live region that appears at the same moment as its
    // text is often missed, because there was nothing there to change.
    <p className="visually-hidden" role="status">
      {announcement}
    </p>
  );

  const notices = (
    <>
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
    </>
  );

  const summary = result && result.count > 0 && (
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
  );

  // The board is the page. Its title is owed to a screen reader, not to
  // anyone looking at a masthead that already says Skymate.
  const title = <h1 className="visually-hidden">Flight board</h1>;

  return (
    <main
      id="main"
      tabIndex={-1}
      className={narrow ? 'board-page board-page--narrow' : 'board-page'}
    >
      <BoardBackdrop />

      {narrow ? (
        /*
         * One scroller around both, rather than the page itself scrolling.
         * The backdrop is absolute inside this page, so a page that scrolled
         * would carry it off the top and leave the cards on nothing.
         */
        <div className="board-page__scroll">
          {title}

          <SearchSheet
            airport={query.airport}
            direction={query.direction}
            onSearch={handleSearch}
            initial={search}
            isSearching={phase === 'loading'}
          />

          <div className="board-page__under">
            {announce}
            {notices}
            {summary}
          </div>

          <ol className="board-list">
            {flights.map((flight) => (
              <li key={flight.id}>
                <FlightCard flight={flight} onOpen={open} />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <aside className="board-page__side">
            {title}

            <SearchCard
              onSearch={handleSearch}
              isSearching={phase === 'loading'}
              initial={search}
            />

            {announce}
            {notices}
            {summary}
          </aside>

          <FlightBoard
            flights={flights}
            date={query.date}
            start={minutesOfLocal(params.fromLocal)}
            windowHours={query.windowHours}
            onOpen={open}
          />
        </>
      )}
    </main>
  );
}
