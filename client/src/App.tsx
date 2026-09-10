import { useEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

import BoardHeader from './components/BoardHeader';
import ChatDrawer from './components/ChatDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { ToastProvider } from './components/ToastProvider';
import FlightPage from './pages/FlightPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Moves focus to the new page when the route changes.
 *
 * A single-page app swaps the whole view without a page load, so the browser
 * leaves focus where it was: on the nav link that was just used. Tabbing from
 * there walks the header again instead of entering the page, and a screen
 * reader is told nothing happened at all.
 */
function FocusMainOnNavigation() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Not on first load. Focus belongs to the browser until someone navigates.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    document.getElementById('main')?.focus();
  }, [pathname]);

  return null;
}

/**
 * The header for the route you are on.
 *
 * Still in the shell and still outside the boundary, which is what makes it a
 * way out of a page that threw. The board's masthead reads the airport from
 * the URL rather than being handed it, so the shell does not have to know what
 * any page is holding.
 */
function RouteHeader() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  if (pathname !== '/') return <Header />;

  const airport = (params.get('airport') ?? '').toUpperCase();

  return (
    <BoardHeader
      airport={/^[A-Z]{3}$/.test(airport) ? airport : ''}
      direction={params.get('direction') === 'arrival' ? 'arrival' : 'departure'}
    />
  );
}

/**
 * The routes, and the boundary around them.
 *
 * Its own component so it can read the route, which is what the boundary
 * resets on. The header sits outside the boundary so a failed page still shows
 * a way to navigate, and that only means anything if navigating clears it.
 */
function Content() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/flight/:number" element={<FlightPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <RouteHeader />
        <FocusMainOnNavigation />
        <Content />

        {/* Outside Content, so a page that throws does not take the assistant
            down with it, and so the conversation survives navigating. */}
        <ChatDrawer />
      </ToastProvider>
    </BrowserRouter>
  );
}
