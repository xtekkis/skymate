import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTtlCache } from './cache.js';

/**
 * Time is mocked rather than slept through, so expiry is asserted exactly
 * instead of racing a real timer.
 */
describe('createTtlCache', () => {
  it('returns undefined for a key it never held', () => {
    const cache = createTtlCache({ ttlMs: 1000 });
    assert.equal(cache.get('missing'), undefined);
  });

  it('returns what was stored', () => {
    const cache = createTtlCache({ ttlMs: 1000 });
    cache.set('a', { rows: 3 });
    assert.deepEqual(cache.get('a'), { rows: 3 });
  });

  it('serves an entry right up to its expiry', (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const cache = createTtlCache({ ttlMs: 1000 });

    cache.set('a', 1);
    t.mock.timers.tick(999);
    assert.equal(cache.get('a'), 1);
  });

  it('drops an entry once the ttl has passed', (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const cache = createTtlCache({ ttlMs: 1000 });

    cache.set('a', 1);
    t.mock.timers.tick(1001);

    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.size, 0, 'the expired entry should be evicted, not just hidden');
  });

  it('evicts the oldest entry when full', () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);

    assert.equal(cache.get('a'), undefined, 'a was oldest and should be gone');
    assert.equal(cache.get('d'), 4);
    assert.equal(cache.size, 3);
  });

  it('counts a read as recent use, so a hot key survives eviction', () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // a is now newest, b is oldest
    cache.set('d', 4);

    assert.equal(cache.get('a'), 1, 'a was read recently and should survive');
    assert.equal(cache.get('b'), undefined, 'b became the oldest and should be evicted');
  });

  it('overwrites rather than duplicating an existing key', () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 3 });

    cache.set('a', 1);
    cache.set('a', 2);

    assert.equal(cache.get('a'), 2);
    assert.equal(cache.size, 1);
  });

  it('refreshes the ttl when a key is written again', (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const cache = createTtlCache({ ttlMs: 1000 });

    cache.set('a', 1);
    t.mock.timers.tick(800);
    cache.set('a', 2);
    t.mock.timers.tick(800);

    assert.equal(cache.get('a'), 2, 'the second write should have restarted the clock');
  });

  it('empties on clear', () => {
    const cache = createTtlCache({ ttlMs: 10_000 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    assert.equal(cache.size, 0);
    assert.equal(cache.get('a'), undefined);
  });
});
