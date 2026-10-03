import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AirplaneTilt, WarningCircle } from '@phosphor-icons/react';

import BoardBackdrop from '../components/BoardBackdrop';
import BoardSummary from '../components/BoardSummary';
import CountryPicker from '../components/CountryPicker';
import FlightCard from '../components/FlightCard';
import FlightDetail from '../components/FlightDetail';
import type { Arrival } from '../lib/flightArrival';
import FlightBoard from '../components/FlightBoard';
import SearchCard from '../components/SearchCard';
import SearchSheet from '../components/SearchSheet';
import { minutesOfLocal } from '../lib/boardGeometry';
import { paramsFor, queryFrom } from '../lib/searchQuery';
import { useFlightSearch } from '../hooks/useFlightSearch';
import { busiestCountry, inCountry, toCountries } from '../lib/countries';
import { announcementFor } from '../lib/announcement';
import { emptyBoard, readSearch, writeSearch } from '../lib/boardUrl';
import { useBoardChrome } from '../hooks/useBoardChrome';
import { useMediaQuery } from '../hooks/useMediaQuery';
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

export default function HomePage() {
  const showToast = useToast();
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
   * The country the board is showing, chosen for a fresh search and then
   * kept until the reader changes it.
   *
   * Twelve hours out of a large airport is five hundred flights. Every one of
   * them is already fetched, so this is a choice about what to draw rather
   * than a second request.
   */
  const [country, setCountry] = useState<string | null>(null);

  /*
   * The destination the board is narrowed to, if any.
   *
   * Held here rather than in the URL, unlike the search itself. The URL is
   * what the search hook watches, so writing a filter into it would re-run the
   * search on every chip press and spend an AeroDataBox unit to rearrange
   * cards already on screen. This is a view over data we have, not a new query.
   */
  const [destination, setDestination] = useState<string | null>(null);

  /*
   * The flight whose panel is open, by id rather than by object.
   *
   * An id survives the list being re-filtered underneath it, and it lets the
   * panel close on its own when a new search no longer contains that flight,
   * instead of showing a card that has left the board.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /*
   * The far end of the flights somebody has actually asked about, by id.
   *
   * Kept for as long as the results are, so a departures board fills in
   * arrivals a flight at a time and a second look at one costs nothing.
   */
  const [arrivals, setArrivals] = useState<Record<string, Arrival>>({});

  // A filter belongs to the results it was chosen from, and so does an open
  // flight. The country opens on whichever has the most flights in them.
  useEffect(() => {
    setDestination(null);
    setSelectedId(null);
    setCountry(result ? busiestCountry(result.flights) : null);
    // A new search is new flights, and these were about the old ones.
    setArrivals({});
  }, [result]);

  const all = result?.flights ?? [];
  const countries = toCountries(all);

  // The country first, then the destination inside it. Both are views over
  // flights already in hand.
  const here = inCountry(all, country);
  const flights = destination
    ? here.filter((flight) => flight.counterpart.iata === destination)
    : here;

  /** Changing country makes a destination inside the old one meaningless. */
  function chooseCountry(code: string) {
    setCountry(code);
    setDestination(null);
  }

  useBoardChrome();

  useEffect(() => {
    // A rate limit or a spent allowance is a condition of the site, not a
    // problem with this search, so it is also said out of band.
    if (phase === 'error' && SITE_WIDE.has(httpStatus ?? 0)) showToast({ message: error });
  }, [phase, httpStatus, error, showToast]);

  const announcement = announcementFor({ phase, result, shown: flights.length, destination });

  /** Submitting writes the URL. The hook notices and does the work. */
  function handleSearch(next: SearchParams) {
    setSearchParams(writeSearch(next));
  }

  const open = (flight: Flight) => setSelectedId(flight.id);
  const close = useCallback(() => setSelectedId(null), []);

  // Looked up in everything fetched, not only what is shown, so narrowing to a
  // destination does not snatch away a flight that is being read.
  const selected = result?.flights.find((flight) => flight.id === selectedId) ?? null;

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

  const picker = (
    <CountryPicker countries={countries} value={country} onChange={chooseCountry} />
  );

  const summary = result && result.count > 0 && (
    <BoardSummary
      flights={here}
      direction={result.direction}
      airport={result.airport}
      from={result.from}
      to={result.to}
      shown={flights.length}
      selected={destination}
      onSelect={setDestination}
      isSearching={phase === 'loading'}
      picker={picker}
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
          </div>

          {/* Outside the padded region on purpose, so the row it scrolls runs
              to both edges rather than stopping short of them. */}
          {result && result.count > 0 && (
            <BoardSummary
              compact
              flights={here}
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

          {picker}

          <ol className="board-list">
            {flights.map((flight) => (
              <li key={flight.id}>
                <FlightCard
                  flight={flight}
                  onOpen={open}
                  selected={flight.id === selectedId}
                  arrival={arrivals[flight.id]}
                />
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
            selectedId={selectedId}
            arrivals={arrivals}
            loading={phase === 'loading'}
          />
        </>
      )}
      {selected && result && (
        <FlightDetail
          flight={selected}
          airport={result.airport}
          onClose={close}
          arrival={arrivals[selected.id]}
          onChecked={(checked, found) =>
            setArrivals((current) => ({ ...current, [checked.id]: found }))
          }
        />
      )}
    </main>
  );
}
