import { Router } from 'express';

import { buildSystemPrompt, chat, NoProviderError, ProviderError } from '../services/ai/index.js';

const router = Router();

/**
 * These are cost controls before they are validation. Every character here is
 * billed, so the ceilings are deliberately tight rather than generous.
 */
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_TOTAL_CHARS = 8000;

const ROLES = new Set(['user', 'assistant']);

function readBody(body) {
  const errors = [];
  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (!messages || messages.length === 0) {
    return { messages: [], errors: ['messages must be a non-empty array'] };
  }

  if (messages.length > MAX_MESSAGES) {
    errors.push(`messages must contain ${MAX_MESSAGES} entries or fewer`);
  }

  let total = 0;

  for (const [index, message] of messages.entries()) {
    if (!ROLES.has(message?.role)) {
      errors.push(`messages[${index}].role must be 'user' or 'assistant'`);
    }

    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!content) {
      errors.push(`messages[${index}].content must be a non-empty string`);
      continue;
    }

    if (content.length > MAX_MESSAGE_CHARS) {
      errors.push(`messages[${index}].content must be ${MAX_MESSAGE_CHARS} characters or fewer`);
    }

    total += content.length;
  }

  if (total > MAX_TOTAL_CHARS) {
    errors.push(`the conversation must be ${MAX_TOTAL_CHARS} characters or fewer in total`);
  }

  // The model has nothing to answer if the newest turn is not a question.
  if (messages.at(-1)?.role !== 'user') {
    errors.push('the last message must be from the user');
  }

  return {
    messages: messages.map((message) => ({
      role: message?.role,
      content: typeof message?.content === 'string' ? message.content.trim() : '',
    })),
    errors,
  };
}

router.post('/', async (req, res, next) => {
  const { messages, errors } = readBody(req.body);

  if (errors.length > 0) {
    res.status(400).json({ error: 'Invalid conversation.', details: errors });
    return;
  }

  try {
    const reply = await chat({ system: buildSystemPrompt(), messages });

    // Token counts are logged, not returned: the budget is ours to watch, and
    // the client has no use for them.
    console.log(
      `[skymate] chat via ${reply.provider}/${reply.model} ` +
        `in=${reply.usage?.inputTokens ?? 0} out=${reply.usage?.outputTokens ?? 0}`,
    );

    res.json({ reply: reply.text });
  } catch (error) {
    if (error instanceof NoProviderError || error instanceof ProviderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
