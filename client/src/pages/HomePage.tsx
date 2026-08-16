import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { getHealth } from '../services/api';

type ServerState = 'checking' | 'online' | 'offline';

/** Placeholder body. The search form and results board land in later commits. */
export default function HomePage() {
  const [server, setServer] = useState<ServerState>('checking');

  useEffect(() => {
    let active = true;

    getHealth()
      .then(() => active && setServer('online'))
      .catch(() => active && setServer('offline'));

    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.main
      className="page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1>Flight schedules</h1>
      <p>Search live departures and arrivals by airport.</p>
      <p>Server: {server}</p>
    </motion.main>
  );
}
