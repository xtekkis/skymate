import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { ToastProvider } from './components/ToastProvider';
import AssistantPage from './pages/AssistantPage';
import FlightPage from './pages/FlightPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Header />
        {/* Inside the header, so a failed page still leaves a way to navigate. */}
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/flight/:number" element={<FlightPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
