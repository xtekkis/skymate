import { useState } from 'react';
import { motion } from 'framer-motion';

import SearchForm from '../components/SearchForm';
import type { SearchParams } from '../models';

export default function HomePage() {
  const [search, setSearch] = useState<SearchParams | null>(null);

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

      <SearchForm onSearch={setSearch} />

      {/* Temporary readout. The results board replaces this once the API route exists. */}
      {search && (
        <p className="tabular" style={{ marginTop: 'var(--space-5)' }}>
          {search.airport} {search.direction}s from {search.fromLocal} to {search.toLocal}
        </p>
      )}
    </motion.main>
  );
}
