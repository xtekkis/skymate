import { createApp, registerProviders } from './app.js';
import { config, reportMissingConfig } from './services/config.js';

reportMissingConfig();

const aiProviders = registerProviders();
console.log(
  aiProviders.length > 0
    ? `[skymate] assistant providers: ${aiProviders.join(', ')}`
    : '[skymate] no assistant provider configured',
);

createApp().listen(config.port, () => {
  console.log(`[skymate] server listening on http://localhost:${config.port}`);
});
