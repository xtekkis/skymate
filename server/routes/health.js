import { Router } from 'express';

import { config } from '../services/config.js';
import { hasBudget } from '../services/quota.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'skymate-server',
    uptime: process.uptime(),
    integrations: {
      // Whether it is configured, and whether it can still answer. The exact
      // count stays private: it tells anyone watching how close we are to empty.
      aeroDataBox: Boolean(config.rapidApiKey),
      flightDataAvailable: Boolean(config.rapidApiKey) && hasBudget(),
      anthropic: Boolean(config.anthropicApiKey),
    },
  });
});

export default router;
