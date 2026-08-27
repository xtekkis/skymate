import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { hasBudget, recordUnits, RESERVE, resetQuota, unitsRemaining } from './quota.js';

describe('quota tracking', () => {
  beforeEach(() => resetQuota());

  it('allows requests before anything is known', () => {
    // Refusing on a guess is worse than calling once and reading the header.
    assert.equal(unitsRemaining(), null);
    assert.equal(hasBudget(), true);
  });

  it('records what the upstream response reported', () => {
    recordUnits('412');
    assert.equal(unitsRemaining(), 412);
    assert.equal(hasBudget(), true);
  });

  it('stops before the budget is completely gone', () => {
    recordUnits(String(RESERVE + 1));
    assert.equal(hasBudget(), true, 'one above the reserve should still work');

    recordUnits(String(RESERVE));
    assert.equal(hasBudget(), false, 'at the reserve it should refuse');

    recordUnits('0');
    assert.equal(hasBudget(), false);
  });

  it('ignores a header it cannot read rather than guessing', () => {
    recordUnits('300');
    for (const junk of [undefined, null, '', 'lots', NaN, '-4']) {
      recordUnits(junk);
      assert.equal(unitsRemaining(), 300, `"${junk}" should not have changed anything`);
    }
  });

  it('recovers when the cycle resets and the count goes back up', () => {
    recordUnits('2');
    assert.equal(hasBudget(), false);

    recordUnits('600');
    assert.equal(hasBudget(), true, 'a new cycle should lift the block by itself');
  });
});
