import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  availableProviders,
  chat,
  NoProviderError,
  ProviderError,
  registerProvider,
  resetProviders,
} from './provider.js';

/** A provider that records whether it was asked, so we can assert it was skipped. */
function fake(name, { configured = true, fail = null, reply = null } = {}) {
  const calls = { count: 0 };

  return {
    calls,
    provider: {
      name,
      isConfigured: () => configured,
      async chat() {
        calls.count += 1;
        if (fail) throw fail;
        return reply ?? { text: `from ${name}`, provider: name, model: 'test' };
      },
    },
  };
}

const transient = (name) =>
  new ProviderError('busy', { provider: name, status: 429, retryable: true });

const permanent = (name) =>
  new ProviderError('bad request', { provider: name, status: 400, retryable: false });

describe('provider registry', () => {
  beforeEach(() => resetProviders());

  it('rejects a provider missing part of the contract', () => {
    assert.throws(() => registerProvider({ name: 'x', isConfigured: () => true }), /chat/);
    assert.throws(() => registerProvider({ isConfigured: () => true, chat: async () => {} }), /name/);
  });

  it('hides providers with no credentials', () => {
    registerProvider(fake('unconfigured', { configured: false }).provider);
    registerProvider(fake('ready').provider);

    assert.deepEqual(
      availableProviders().map((provider) => provider.name),
      ['ready'],
    );
  });

  it('refuses when nothing is configured', async () => {
    registerProvider(fake('unconfigured', { configured: false }).provider);

    await assert.rejects(() => chat({ messages: [], system: '' }), (error) => {
      assert.ok(error instanceof NoProviderError);
      assert.equal(error.status, 503);
      return true;
    });
  });

  it('uses the first provider and leaves the rest alone', async () => {
    const primary = fake('primary');
    const backup = fake('backup');
    registerProvider(primary.provider);
    registerProvider(backup.provider);

    const reply = await chat({ messages: [], system: '' });

    assert.equal(reply.provider, 'primary');
    assert.equal(backup.calls.count, 0, 'the backup should not have been touched');
  });

  it('falls through when a failure might succeed elsewhere', async () => {
    const primary = fake('primary', { fail: transient('primary') });
    const backup = fake('backup');
    registerProvider(primary.provider);
    registerProvider(backup.provider);

    const reply = await chat({ messages: [], system: '' });

    assert.equal(reply.provider, 'backup');
    assert.equal(backup.calls.count, 1);
  });

  it('stops immediately on a failure no provider could fix', async () => {
    // A malformed request fails identically everywhere, so retrying it just
    // buys a second identical failure at twice the cost.
    const primary = fake('primary', { fail: permanent('primary') });
    const backup = fake('backup');
    registerProvider(primary.provider);
    registerProvider(backup.provider);

    await assert.rejects(() => chat({ messages: [], system: '' }), /bad request/);
    assert.equal(backup.calls.count, 0, 'the backup must not be tried');
  });

  it('skips an unconfigured provider without counting it as a failure', async () => {
    const primary = fake('primary', { configured: false });
    const backup = fake('backup');
    registerProvider(primary.provider);
    registerProvider(backup.provider);

    const reply = await chat({ messages: [], system: '' });

    assert.equal(reply.provider, 'backup');
    assert.equal(primary.calls.count, 0);
  });

  it('surfaces the last error when every provider fails', async () => {
    registerProvider(fake('primary', { fail: transient('primary') }).provider);
    registerProvider(fake('backup', { fail: transient('backup') }).provider);

    await assert.rejects(() => chat({ messages: [], system: '' }), (error) => {
      assert.equal(error.provider, 'backup', 'the final failure should be the one reported');
      return true;
    });
  });

  it('tries providers in registration order', async () => {
    const order = [];
    for (const name of ['first', 'second', 'third']) {
      registerProvider({
        name,
        isConfigured: () => true,
        async chat() {
          order.push(name);
          throw transient(name);
        },
      });
    }

    await assert.rejects(() => chat({ messages: [], system: '' }));
    assert.deepEqual(order, ['first', 'second', 'third']);
  });
});
