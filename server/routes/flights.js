import { Router } from 'express';

import { fetchAirportSchedule, UpstreamError } from '../services/aerodatabox.js';
import { toFlights } from '../services/flightMapper.js';

const router = Router();

const IATA = /^[A-Z]{3}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_WINDOW_HOURS = 12;

/**
 * Validates up front so a malformed request never reaches AeroDataBox and
 * burns quota. Collects every problem rather than reporting only the first.
 */
function readQuery(query) {
  const errors = [];

  const airport = String(query.airport ?? '').trim().toUpperCase();
  if (!IATA.test(airport)) errors.push('airport must be a 3-letter IATA code');

  const direction = String(query.direction ?? 'departure').toLowerCase();
  if (direction !== 'departure' && direction !== 'arrival') {
    errors.push("direction must be 'departure' or 'arrival'");
  }

  const from = String(query.from ?? '');
  const to = String(query.to ?? '');
  if (!LOCAL_DATETIME.test(from)) errors.push('from must look like YYYY-MM-DDTHH:mm');
  if (!LOCAL_DATETIME.test(to)) errors.push('to must look like YYYY-MM-DDTHH:mm');

  if (LOCAL_DATETIME.test(from) && LOCAL_DATETIME.test(to)) {
    const hours = (new Date(`${to}:00`) - new Date(`${from}:00`)) / 3_600_000;
    if (hours <= 0) errors.push('to must be after from');
    else if (hours > MAX_WINDOW_HOURS) errors.push(`window must be ${MAX_WINDOW_HOURS} hours or less`);
  }

  return { airport, direction, from, to, errors };
}

router.get('/', async (req, res, next) => {
  const { airport, direction, from, to, errors } = readQuery(req.query);

  if (errors.length > 0) {
    res.status(400).json({ error: 'Invalid search.', details: errors });
    return;
  }

  try {
    const raw = await fetchAirportSchedule({ airport, direction, fromLocal: from, toLocal: to });
    const flights = toFlights(raw, direction);

    res.json({ airport, direction, from, to, count: flights.length, flights });
  } catch (error) {
    if (error instanceof UpstreamError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
