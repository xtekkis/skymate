import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSystemPrompt } from './systemPrompt.js';

const AUGUST = new Date('2026-08-16T09:00:00Z');

describe('the system prompt', () => {
  it('tells the model what day it is', () => {
    assert.match(buildSystemPrompt({ today: AUGUST }), /2026-08-16/);
  });

  it('says nothing about an airport when none is being looked at', () => {
    const prompt = buildSystemPrompt({ today: AUGUST });

    assert.equal(/flight board open on/.test(prompt), false);
  });

  it('names the airport the board is showing', () => {
    const prompt = buildSystemPrompt({ today: AUGUST, airport: 'LHR' });

    assert.match(prompt, /flight board open on LHR/);
    // So that "how early should I get here" has an answer.
    assert.match(prompt, /take them to mean LHR/);
  });

  it('does not let context read as capability', () => {
    const prompt = buildSystemPrompt({ today: AUGUST, airport: 'LHR' });

    // Knowing which board is open is not knowing anything about a flight, and
    // the paragraph that grants the context has to say so where the model
    // reads it, not only in the rules further down.
    assert.match(prompt, /no live flight data for LHR/);
  });

  it('reads the same however it is called', () => {
    const withoutContext = buildSystemPrompt({ today: AUGUST });
    const withContext = buildSystemPrompt({ today: AUGUST, airport: 'CDG' });

    // The product rules are the product rules. Context is added, never traded.
    for (const rule of [
      /You have no access to live flight data/,
      /cannot book, change or cancel/,
      /No legal or medical advice/,
      /Never write an em dash/,
    ]) {
      assert.match(withoutContext, rule);
      assert.match(withContext, rule);
    }
  });
});
