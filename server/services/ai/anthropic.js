import Anthropic from '@anthropic-ai/sdk';

import { config } from '../config.js';
import { ProviderError } from './provider.js';

const MODEL = 'claude-sonnet-5';

/**
 * Answering travel questions is not reasoning-heavy work, and effort is the
 * lever the security review asked for on cost. Thinking stays on because
 * disabling it on this model has known failure modes; it just stays shallow.
 */
const EFFORT = 'low';

/**
 * A deliberate ceiling rather than the usual default. Chat replies should be a
 * few paragraphs, and an unbounded cap on a per-token-billed endpoint is the
 * kind of thing that turns a loop into an invoice. Length is shaped by the
 * system prompt; this is the hard stop behind it.
 */
const MAX_TOKENS = 4096;

let client;

function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/**
 * `retryable` asks "might another provider succeed?", not "was this transient?".
 * A bad API key is permanent but another vendor's key may be fine, so it counts.
 * A malformed request does not: it would fail identically anywhere.
 */
function toProviderError(error) {
  const base = { provider: 'anthropic', cause: error };

  if (error instanceof Anthropic.BadRequestError) {
    return new ProviderError('The assistant could not handle that request.', {
      ...base,
      status: 400,
      retryable: false,
    });
  }

  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error('[skymate] Anthropic rejected our credentials');
    return new ProviderError('The assistant is unavailable right now.', {
      ...base,
      status: 502,
      retryable: true,
    });
  }

  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('The assistant is busy. Try again shortly.', {
      ...base,
      status: 429,
      retryable: true,
    });
  }

  console.error('[skymate] Anthropic request failed:', error?.message);
  return new ProviderError('The assistant is unavailable right now.', {
    ...base,
    status: 502,
    retryable: true,
  });
}

export const anthropicProvider = {
  name: 'anthropic',

  isConfigured: () => Boolean(config.anthropicApiKey),

  async chat({ messages, system, maxTokens = MAX_TOKENS }) {
    let response;

    try {
      response = await getClient().messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages,
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT },
      });
    } catch (error) {
      throw toProviderError(error);
    }

    // A decline is an outcome, not a failure. Falling back to another provider
    // to get a different answer to the same refused question is not the goal.
    if (response.stop_reason === 'refusal') {
      return {
        text: 'I would rather not answer that one. Ask me anything about your trip.',
        provider: 'anthropic',
        model: response.model,
        usage: readUsage(response),
      };
    }

    if (response.stop_reason === 'max_tokens') {
      console.warn('[skymate] assistant reply hit the token ceiling and was cut short');
    }

    return {
      text: response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim(),
      provider: 'anthropic',
      model: response.model,
      usage: readUsage(response),
    };
  },
};

function readUsage(response) {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
