import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  errorStatus,
  getFlightByNumber,
  messageFromError,
  searchAirports,
  searchFlights,
  sendChat,
} from './api';

/**
 * The two functions that decide what every failure in this app says to a
 * person, and what it declines to say.
 */

/** A failure the server answered, the way a 4xx from our routes arrives. */
const withResponse = (status: number, body: unknown) =>
  new ApiError(`The server answered ${status}.`, { status, body: body as never });

/** A failure where nothing answered at all. */
const noAnswer = () => new ApiError('The request never reached the server.');

const GENERIC = 'Something went wrong. Try again.';

describe('reading the status behind a failure', () => {
  it('reports what the server answered with', () => {
    expect(errorStatus(withResponse(429, {}))).toBe(429);
    expect(errorStatus(withResponse(503, {}))).toBe(503);
  });

  it('reports nothing when nothing answered', () => {
    // This is what tells a site-wide condition apart from a dead connection,
    // and it is why the toast fires on 429 and 503 but not on a network drop.
    expect(errorStatus(noAnswer())).toBeUndefined();
  });

  it('reports nothing for a failure that is not a request at all', () => {
    expect(errorStatus(new Error('boom'))).toBeUndefined();
    expect(errorStatus('boom')).toBeUndefined();
    expect(errorStatus(null)).toBeUndefined();
    expect(errorStatus(undefined)).toBeUndefined();
  });
});

describe('turning a failure into something worth showing', () => {
  it('prefers the server’s own wording over anything invented here', () => {
    const message = messageFromError(
      withResponse(400, { error: 'The monthly flight data allowance is used up.' }),
    );

    // The server writes its messages for people rather than for logs, so the
    // client has nothing better to say than what it was told.
    expect(message).toBe('The monthly flight data allowance is used up.');
  });

  it('joins several validation problems into one sentence', () => {
    const message = messageFromError(
      withResponse(400, {
        error: 'Invalid search.',
        details: ['airport must be a 3-letter IATA code', 'to must be after from'],
      }),
    );

    // The flights route reports every problem at once rather than the first,
    // and this is the half of that promise the user actually sees.
    expect(message).toBe('airport must be a 3-letter IATA code. to must be after from');
  });

  it('falls back to the summary when the details are empty', () => {
    const message = messageFromError(withResponse(400, { error: 'Invalid search.', details: [] }));

    expect(message).toBe('Invalid search.');
  });

  it('says the server is unreachable rather than that something went wrong', () => {
    // Worth its own wording: in development this is nearly always the server
    // not running, and "is it running" is a sentence you can act on.
    expect(messageFromError(noAnswer())).toBe('Could not reach the server. Is it running?');
  });

  it('says something generic when the response carried no message', () => {
    expect(messageFromError(withResponse(500, {}))).toBe(GENERIC);
    expect(messageFromError(withResponse(502, undefined))).toBe(GENERIC);
  });

  it('never puts an internal failure on screen', () => {
    const internal = new Error('connect ECONNREFUSED 10.0.0.4:5432');

    // Same reasoning the server uses for a 5xx: a 4xx message was written for
    // a person, and anything else can carry hosts, paths or library internals.
    expect(messageFromError(internal)).toBe(GENERIC);
    expect(messageFromError(internal)).not.toContain('ECONNREFUSED');
    expect(messageFromError(internal)).not.toContain('10.0.0.4');
  });

  it('survives being handed something that is not an error', () => {
    // A rejected promise can carry anything at all, and this runs inside a
    // catch that never gets to choose.
    expect(messageFromError('a string')).toBe(GENERIC);
    expect(messageFromError(null)).toBe(GENERIC);
    expect(messageFromError(undefined)).toBe(GENERIC);
    expect(messageFromError({ nothing: true })).toBe(GENERIC);
  });
});

describe('where the requests go', () => {
  /*
   * The base is read once when the module loads, so each case needs the
   * module loaded again with a different environment.
   */
  async function baseWith(url?: string) {
    vi.resetModules();

    if (url === undefined) vi.stubEnv('VITE_API_URL', '');
    else vi.stubEnv('VITE_API_URL', url);

    const { apiBase } = await import('./api');
    return apiBase;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is this origin when nothing says otherwise', async () => {
    // Development, and anywhere the two halves are served together.
    expect(await baseWith()).toBe('/api');
  });

  it('is wherever the build was told the API lives', async () => {
    // Deployed apart, a static site has no /api of its own: asking for one
    // returns its index.html and every call fails as a parse error.
    expect(await baseWith('https://skymate-api.onrender.com/api')).toBe(
      'https://skymate-api.onrender.com/api',
    );
  });

  it('does not mind a trailing slash', async () => {
    // Left on, every path would be doubled: /api//flights.
    expect(await baseWith('https://skymate-api.onrender.com/api/')).toBe(
      'https://skymate-api.onrender.com/api',
    );
  });
});

describe('making a request', () => {
  const realFetch = globalThis.fetch;
  let calls: { url: URL; init: RequestInit }[];

  /** Answers every request with this, and records what was asked. */
  function answerWith(status: number, body: unknown, { json = true } = {}) {
    calls = [];

    globalThis.fetch = ((input: URL, init: RequestInit) => {
      calls.push({ url: new URL(String(input)), init });

      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => (json ? Promise.resolve(body) : Promise.reject(new Error('not json'))),
      } as Response);
    }) as typeof globalThis.fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const window = {
    airport: 'LHR',
    direction: 'departure' as const,
    fromLocal: '2026-09-01T08:00',
    toLocal: '2026-09-01T12:00',
  };

  it('asks the API for what was wanted, with the search in the query', async () => {
    answerWith(200, { airport: 'LHR', count: 0, flights: [] });

    await searchFlights(window);

    const { url } = calls[0];
    expect(url.pathname.endsWith('/flights')).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      airport: 'LHR',
      direction: 'departure',
      from: '2026-09-01T08:00',
      to: '2026-09-01T12:00',
    });
  });

  it('sends no content type on a GET', async () => {
    answerWith(200, { query: 'lon', count: 0, airports: [] });

    await searchAirports('lon');

    // Not a header a browser will send cross-origin without asking first, so
    // putting it on a GET turns every search into two round trips.
    expect(calls[0].init.headers).toBeUndefined();
    expect(calls[0].init.method).toBe('GET');
  });

  it('leaves out a parameter that was not given', async () => {
    answerWith(200, { number: 'BA117', count: 0, flights: [] });

    await getFlightByNumber('BA 117');

    expect(calls[0].url.searchParams.has('date')).toBe(false);
    // And escapes the one that was, since a flight number carries a space.
    expect(calls[0].url.pathname.endsWith('/flights/number/BA%20117')).toBe(true);
  });

  it('posts a conversation as JSON', async () => {
    answerWith(200, { reply: 'Two hours.' });

    const reply = await sendChat([{ role: 'user', content: 'How early?' }], 'LHR');

    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      messages: [{ role: 'user', content: 'How early?' }],
      airport: 'LHR',
    });
    expect(reply).toBe('Two hours.');
  });

  it('turns a refusal into the error the pages already understand', async () => {
    answerWith(503, { error: 'The monthly flight data allowance is used up.' });

    const failure = await searchFlights(window).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(errorStatus(failure)).toBe(503);
    expect(messageFromError(failure)).toBe('The monthly flight data allowance is used up.');
  });

  it('survives a failure that is not JSON', async () => {
    // A proxy or a host answering with HTML is still a failure, and the page
    // has its own wording for one it cannot read.
    answerWith(502, undefined, { json: false });

    const failure = await searchFlights(window).catch((error: unknown) => error);

    expect(errorStatus(failure)).toBe(502);
    expect(messageFromError(failure)).toBe(GENERIC);
  });

  it('says nothing answered when nothing did', async () => {
    calls = [];
    globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof globalThis.fetch;

    const failure = await searchFlights(window).catch((error: unknown) => error);

    // No status is what tells a dead connection from a site-wide condition.
    expect(errorStatus(failure)).toBeUndefined();
    expect(messageFromError(failure)).toBe('Could not reach the server. Is it running?');
  });
});
