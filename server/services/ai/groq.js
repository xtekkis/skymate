import { config } from '../config.js';
import { ProviderError } from './provider.js';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Chosen by testing the models this account can reach against the probes that
 * matter for a travel app. gpt-oss-120b refused to invent a gate, got a
 * Frankfurt bag-transfer question right, and answered in under a second.
 * qwen3.6-27b leaked raw <think> blocks into its content, so it is unusable
 * here without stripping.
 */
const MODEL = 'openai/gpt-oss-120b';

/** Raw fetch rather than an SDK: one POST, and the error mapping is ours anyway. */
export const groqProvider = {
  name: 'groq',

  isConfigured: () => Boolean(config.groqApiKey),

  async chat({ messages, system, maxTokens = 1024 }) {
    let response;

    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        // Groq speaks the OpenAI shape, where the system prompt is the first
        // message rather than a separate field as it is on Anthropic.
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error.name === 'TimeoutError';
      throw new ProviderError(
        timedOut ? 'The assistant timed out. Try again.' : 'The assistant is unavailable right now.',
        { provider: 'groq', status: timedOut ? 504 : 502, retryable: true, cause: error },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[skymate] Groq returned ${response.status}:`, detail.slice(0, 200));

      // A malformed request fails the same way anywhere; everything else is
      // worth another provider's turn.
      throw new ProviderError(
        response.status === 429
          ? 'The assistant is busy. Try again shortly.'
          : 'The assistant is unavailable right now.',
        {
          provider: 'groq',
          status: response.status === 429 ? 429 : 502,
          retryable: response.status !== 400,
        },
      );
    }

    const body = await response.json();
    const text = body.choices?.[0]?.message?.content?.trim() ?? '';

    if (body.choices?.[0]?.finish_reason === 'length') {
      console.warn('[skymate] Groq reply hit the token ceiling and was cut short');
    }

    return {
      text,
      provider: 'groq',
      model: body.model ?? MODEL,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      },
    };
  },
};
