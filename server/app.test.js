import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createApp } from './app.js';

/**
 * Boots the real app on an ephemeral port and makes real requests.
 *
 * Every case here is either local or a validation failure, so nothing in this
 * file reaches AeroDataBox or Anthropic. Tests that spend quota are tests
 * nobody runs.
 */
let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const get = (path, init) => fetch(`${base}${path}`, init);
const postJson = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('GET /api/health', () => {
  it('reports the service and its integrations', async () => {
    const response = await get('/api/health');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'skymate-server');
    assert.equal(typeof body.integrations.aeroDataBox, 'boolean');
    assert.equal(typeof body.integrations.flightDataAvailable, 'boolean');
  });

  it('does not publish how much quota is left', async () => {
    // Knowing the exact count only helps someone trying to finish it off.
    const body = await (await get('/api/health')).json();
    assert.equal(JSON.stringify(body).includes('unitsRemaining'), false);
  });
});

describe('GET /api/airports', () => {
  it('ranks the city someone meant first', async () => {
    const body = await (await get('/api/airports?q=lond')).json();
    assert.equal(body.airports[0].municipality, 'London');
  });

  it('refuses a query too short to mean anything', async () => {
    const response = await get('/api/airports?q=l');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /at least/i);
  });

  it('answers an unmatched query with an empty list, not an error', async () => {
    const response = await get('/api/airports?q=zzzzzzzz');
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).airports, []);
  });
});

describe('GET /api/flights', () => {
  it('reports every problem at once rather than the first', async () => {
    const response = await get('/api/flights');
    assert.equal(response.status, 400);

    const { details } = await response.json();
    assert.ok(details.length >= 3, `expected several problems, got ${JSON.stringify(details)}`);
  });

  it('rejects a window longer than the upstream allows', async () => {
    const response = await get('/api/flights?airport=LHR&from=2026-09-01T00:00&to=2026-09-01T20:00');
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /12 hours or less/);
  });

  it('rejects a backwards window', async () => {
    const response = await get('/api/flights?airport=LHR&from=2026-09-01T10:00&to=2026-09-01T08:00');
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /after from/);
  });

  it('rejects something that is not an airport code', async () => {
    const response = await get('/api/flights?airport=LONDON&from=2026-09-01T08:00&to=2026-09-01T10:00');
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /3-letter IATA/);
  });
});

describe('POST /api/chat', () => {
  it('needs a conversation', async () => {
    const response = await postJson('/api/chat', {});
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /non-empty array/);
  });

  it('rejects a role it does not model', async () => {
    const response = await postJson('/api/chat', { messages: [{ role: 'system', content: 'x' }] });
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /'user' or 'assistant'/);
  });

  it('requires the newest turn to be a question', async () => {
    const response = await postJson('/api/chat', {
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
    });
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /last message must be from the user/);
  });

  it('caps a single message', async () => {
    const response = await postJson('/api/chat', {
      messages: [{ role: 'user', content: 'a'.repeat(2100) }],
    });
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /2000 characters or fewer/);
  });

  it('explains malformed JSON without quoting the body back', async () => {
    const response = await postJson('/api/chat', '{"messages":');
    assert.equal(response.status, 400);

    const { error } = await response.json();
    assert.equal(error, 'Request body is not valid JSON.');
    assert.equal(error.includes('messages'), false, 'the broken body should not be echoed');
  });
});

describe('the app around the routes', () => {
  it('answers an unknown path with JSON, not HTML', async () => {
    const response = await get('/api/nope');
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  });

  it('sends the security headers', async () => {
    const response = await get('/api/health');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('strict-transport-security'));
    // Wrong for an API, and the dev proxy hides the mistake until deployment.
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  it('advertises a rate limit policy per endpoint', async () => {
    const health = await get('/api/health');
    const flights = await get('/api/flights?airport=XX');

    assert.notEqual(
      health.headers.get('ratelimit-policy'),
      flights.headers.get('ratelimit-policy'),
      'cheap and expensive endpoints should not share a budget',
    );
  });

  it('allows a listed origin and stays silent for others', async () => {
    const allowed = await get('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    // A lookalike prefix is exactly what a loose check would let through.
    const spoofed = await get('/api/health', {
      headers: { Origin: 'http://localhost:5173.evil.com' },
    });
    assert.equal(spoofed.headers.get('access-control-allow-origin'), null);
  });
});
