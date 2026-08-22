import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { apiLimiter, chatLimiter, flightSearchLimiter, healthLimiter } from './middleware/rateLimit.js';
import { registerDefaultProviders } from './services/ai/index.js';
import { config, reportMissingConfig } from './services/config.js';
import chatRouter from './routes/chat.js';
import flightsRouter from './routes/flights.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(
  helmet({
    // This process answers JSON, never HTML, so the browser is meant to read it
    // from the frontend's origin. same-origin (the default) is the wrong claim
    // for an API, and the dev proxy would hide the mistake until deployment.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

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
app.use('/api/chat', chatLimiter, chatRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  const status = Number(err.status) || 500;

  console.error(`[skymate] ${req.method} ${req.originalUrl} -> ${status}`, err);

  // Body parser failures are client mistakes, but its messages quote the body
  // back, so they get their own wording.
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large.' });
    return;
  }

  // 4xx messages are written deliberately for clients. 5xx messages come from
  // wherever the bug was, and can carry file paths, queries or library
  // internals, so they stay in the log.
  res.status(status).json({
    error: status < 500 ? err.message || 'Request failed.' : 'Internal server error.',
  });
});

reportMissingConfig();

const aiProviders = registerDefaultProviders();
console.log(
  aiProviders.length > 0
    ? `[skymate] assistant providers: ${aiProviders.join(', ')}`
    : '[skymate] no assistant provider configured',
);

app.listen(config.port, () => {
  console.log(`[skymate] server listening on http://localhost:${config.port}`);
});
