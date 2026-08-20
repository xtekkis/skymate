import { rateLimit } from 'express-rate-limit';

/**
 * Broad guard over everything under /api. Generous on purpose: this exists to
 * stop abuse, not to throttle ordinary use.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again shortly.' },
});

/**
 * Flight search is the expensive path. Every cache miss spends AeroDataBox
 * quota against a budget of roughly 600 units a month, so an open endpoint is
 * a way to burn the month in about a minute.
 *
 * The cache does not protect this on its own: it keys on the full URL, so
 * varying one minute of the window produces a fresh key every request.
 */
export const flightSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many searches. Try again in a few minutes.' },
});
