import { anthropicProvider } from './anthropic.js';
import { groqProvider } from './groq.js';
import { availableProviders, registerProvider, resetProviders } from './provider.js';

export { chat, NoProviderError, ProviderError } from './provider.js';
export { buildSystemPrompt } from './systemPrompt.js';

/**
 * Registers the providers this server knows about, in fallback order.
 *
 * Explicit rather than a side effect of importing this module, so boot order is
 * visible and tests can rebuild the registry. Idempotent: safe to call twice.
 *
 * Groq goes below Anthropic when there is a key for it. Until then it does not
 * need a stub, because an unconfigured provider is skipped anyway.
 *
 * @returns {string[]} names of the providers that actually hold credentials
 */
export function registerDefaultProviders() {
  resetProviders();
  registerProvider(anthropicProvider);
  registerProvider(groqProvider);

  return availableProviders().map((provider) => provider.name);
}
