/**
 * The seam every AI provider sits behind.
 *
 * Anthropic is the only provider today. Groq is planned as a fallback, so the
 * registry exists now rather than being retrofitted around a service already
 * written against one SDK.
 *
 * @typedef {object} ChatMessage
 * @property {'user' | 'assistant'} role
 * @property {string} content
 *
 * @typedef {object} ChatRequest
 * @property {ChatMessage[]} messages
 * @property {string} system
 * @property {number} [maxTokens]
 *
 * @typedef {object} ChatReply
 * @property {string} text
 * @property {string} provider  Which provider answered, so callers can report it.
 * @property {string} model
 * @property {{ inputTokens: number, outputTokens: number }} [usage]
 *
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => boolean} isConfigured  False when the key is absent.
 * @property {(request: ChatRequest) => Promise<ChatReply>} chat
 */

/**
 * Errors providers throw. `retryable` decides whether the registry moves on to
 * the next provider: a rate limit or an outage is worth retrying elsewhere, a
 * malformed request is not, and trying it twice would just cost twice.
 */
export class ProviderError extends Error {
  constructor(message, { provider, status = 502, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
  }
}

export class NoProviderError extends Error {
  constructor() {
    super('No AI provider is configured on this server.');
    this.name = 'NoProviderError';
    this.status = 503;
  }
}

/** Registration order is fallback order. */
const providers = [];

export function registerProvider(provider) {
  for (const key of ['name', 'isConfigured', 'chat']) {
    if (!provider?.[key]) throw new Error(`A provider needs a ${key}`);
  }

  providers.push(provider);
  return provider;
}

/** Only providers that actually hold credentials can take a turn. */
export function availableProviders() {
  return providers.filter((provider) => provider.isConfigured());
}

export function resetProviders() {
  providers.length = 0;
}

/**
 * Tries each configured provider in registration order, moving on only when a
 * failure is worth retrying elsewhere.
 */
export async function chat(request) {
  const usable = availableProviders();
  if (usable.length === 0) throw new NoProviderError();

  let lastError;

  for (const provider of usable) {
    try {
      return await provider.chat(request);
    } catch (error) {
      if (!error?.retryable) throw error;

      console.warn(`[skymate] provider ${provider.name} failed, trying the next:`, error.message);
      lastError = error;
    }
  }

  throw lastError;
}
