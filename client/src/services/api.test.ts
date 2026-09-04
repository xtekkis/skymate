import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import { errorStatus, messageFromError } from './api';

/**
 * The two functions that decide what every failure in this app says to a
 * person, and what it declines to say.
 */

/** An axios error carrying a response, the way a 4xx from our server arrives. */
function withResponse(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse);
}

/** An axios error with no response at all: nothing answered. */
const noAnswer = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);

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
