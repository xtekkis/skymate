import express from 'express';
import cors from 'cors';

import { config, reportMissingConfig } from './services/config.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);

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
