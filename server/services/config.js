import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(serverDir, '.env') });

export const config = {
  port: Number(process.env.PORT) || 3001,
  rapidApiKey: process.env.RAPIDAPI_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};

/**
 * Warns rather than throws, so the server still boots for UI work before
 * every key is in place.
 */
export function reportMissingConfig() {
  const missing = Object.entries({
    RAPIDAPI_KEY: config.rapidApiKey,
    ANTHROPIC_API_KEY: config.anthropicApiKey,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`[skymate] missing environment variables: ${missing.join(', ')}`);
  }

  return missing;
}
