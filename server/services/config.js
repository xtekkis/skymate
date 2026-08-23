import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(serverDir, '.env') });

/**
 * Comma-separated origins allowed to call the API from a browser. Defaults to
 * the Vite dev server, so local work needs no configuration and a deployment
 * that forgets to set this fails closed rather than open.
 */
function readAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS ?? '').trim();
  if (!raw) return ['http://localhost:5173'];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  allowedOrigins: readAllowedOrigins(),
  rapidApiKey: process.env.RAPIDAPI_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
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
