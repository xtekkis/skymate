import { rateLimit } from 'express-rate-limit';

/**
 * Tiers are sized by what a request costs us, not by how it looks. One factory
 * so the shared options stay identical and adding a tier is three lines.
 */
function tier({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    message: { error: message },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
}

/**
 * Health costs nothing: no upstream call, no quota, no storage. Generous enough
 * for a monitor to poll about once a second, and separate so that polling never
 * eats the allowance the real endpoints depend on.
 */
export const healthLimiter = tier({
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Too many requests. Try again shortly.',
});

/**
 * Catch-all for anything under /api without a tier of its own. Broad enough
 * that ordinary use never meets it, narrow enough to stop a script.
 */
export const apiLimiter = tier({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Too many requests. Try again shortly.',
});

/**
 * Flight search spends AeroDataBox quota on every cache miss, against a budget
 * of roughly 600 units a month. The cache does not protect it on its own: keys
 * include the full time window, so shifting one minute makes a fresh key.
 */
export const flightSearchLimiter = tier({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  message: 'Too many searches. Try again in a few minutes.',
});
