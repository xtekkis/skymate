import { Router } from 'express';

import { MIN_QUERY, searchAirports } from '../services/airportDirectory.js';

const router = Router();

const MAX_RESULTS = 8;

router.get('/', (req, res) => {
  const query = String(req.query.q ?? '').trim();

  if (query.length < MIN_QUERY) {
    res.status(400).json({
      error: `Type at least ${MIN_QUERY} characters to search for an airport.`,
    });
    return;
  }

  const airports = searchAirports(query, MAX_RESULTS);
  res.json({ query, count: airports.length, airports });
});

export default router;
