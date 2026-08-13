import { Router } from 'express';

import { config } from '../services/config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'skymate-server',
    uptime: process.uptime(),
    integrations: {
      aeroDataBox: Boolean(config.rapidApiKey),
      anthropic: Boolean(config.anthropicApiKey),
    },
  });
});

export default router;
