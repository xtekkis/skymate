import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Header from './components/Header';
import AssistantPage from './pages/AssistantPage';
import FlightPage from './pages/FlightPage';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/flight/:number" element={<FlightPage />} />
      </Routes>
    </BrowserRouter>
  );
}
