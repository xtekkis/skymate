import express from 'express';
import cors from 'cors';

import { apiLimiter, flightSearchLimiter, healthLimiter } from './middleware/rateLimit.js';
import { config, reportMissingConfig } from './services/config.js';
import flightsRouter from './routes/flights.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header means a same-origin request, curl, or a health probe.
      // Those are not browser cross-origin calls, so there is nothing to block.
      if (!origin) return callback(null, true);

      // Passing false omits the CORS headers, which is what makes the browser
      // refuse. Passing an Error would surface as a 500 instead.
      callback(null, config.allowedOrigins.includes(origin));
    },
  }),
);
app.use(express.json());

// Behind a proxy this must be set correctly or the limiter keys every request
// to the same address. One hop covers the usual single reverse proxy.
app.set('trust proxy', 1);
// Health answers before the broad limiter so monitoring never spends the
// allowance the paid endpoints rely on.
app.use('/api/health', healthLimiter, healthRouter);

app.use('/api', apiLimiter);
app.use('/api/flights', flightSearchLimiter, flightsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[skymate]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

reportMissingConfig();

app.listen(config.port, () => {
  console.log(`[skymate] server listening on http://localhost:${config.port}`);
});
