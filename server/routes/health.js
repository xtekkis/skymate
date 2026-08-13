import { Router } from 'express';

import { env } from '../services/env.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'skymate-server',
    uptime: process.uptime(),
    integrations: {
      aeroDataBox: Boolean(env.rapidApiKey),
      anthropic: Boolean(env.anthropicApiKey),
    },
  });
});

export default router;
