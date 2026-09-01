import { Router } from 'express';

import { fetchAirportSchedule, fetchFlightByNumber, UpstreamError } from '../services/aerodatabox.js';
import { toFlights, toTrackedFlights } from '../services/flightMapper.js';

const router = Router();

const IATA = /^[A-Z]{3}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_WINDOW_HOURS = 12;

const FLIGHT_NUMBER = /^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    // Both sides parsed as UTC. These are times at the airport, in a zone
    // this process knows nothing about, so folding the server's own daylight
    // saving jumps into what should be plain subtraction can measure a
    // 13-hour window as 12 and wave it through to be rejected upstream.
    const hours = (new Date(`${to}:00Z`) - new Date(`${from}:00Z`)) / 3_600_000;
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

/**
 * A flight number can fly several legs, so this answers with a list. An
 * unknown number is an empty list rather than a 404: "no such flight" is an
 * answer, and the client can say so without an error banner.
 */
router.get('/number/:number', async (req, res, next) => {
  // "BA 117" and "ba117" name the same flight.
  const number = String(req.params.number).replace(/\s+/g, '').toUpperCase();
  const date = req.query.date ? String(req.query.date) : undefined;
  const errors = [];

  if (!FLIGHT_NUMBER.test(number)) {
    errors.push('number must look like a flight number, for example BA117');
  }

  if (date !== undefined && !LOCAL_DATE.test(date)) {
    errors.push('date must look like YYYY-MM-DD');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Invalid flight number.', details: errors });
    return;
  }

  try {
    const legs = await fetchFlightByNumber({ number, date });
    const flights = toTrackedFlights(legs);

    res.json({ number, date, count: flights.length, flights });
  } catch (error) {
    if (error instanceof UpstreamError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
