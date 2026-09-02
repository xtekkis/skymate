import { useEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { ToastProvider } from './components/ToastProvider';
import AssistantPage from './pages/AssistantPage';
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
        <Route path="/assistant" element={<AssistantPage />} />
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
        <Header />
        <FocusMainOnNavigation />
        <Content />
      </ToastProvider>
    </BrowserRouter>
  );
}
