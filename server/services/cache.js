/**
 * Small in-memory TTL cache with LRU eviction.
 *
 * Deliberately not a dependency: this holds a bounded number of entries in one
 * process and disappears on restart, which is all a single server needs. Reach
 * for Redis when there is more than one process to share between.
 */
export function createTtlCache({ ttlMs, maxEntries = 100 }) {
  /** Insertion order doubles as the LRU queue, oldest first. */
  const entries = new Map();

  function get(key) {
    const hit = entries.get(key);
    if (!hit) return undefined;

    if (Date.now() > hit.expiresAt) {
      entries.delete(key);
      return undefined;
    }

    // Re-inserting moves this key to the newest position.
    entries.delete(key);
    entries.set(key, hit);
    return hit.value;
  }

  function set(key, value) {
    entries.delete(key);
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });

    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    get,
    set,
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    },
  };
}
