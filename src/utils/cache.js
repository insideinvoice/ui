const PREFIX = "ii_cache_";

/**
 * Read a cached value from localStorage.
 * @param {string} key - cache key
 * @param {number} ttl - time-to-live in ms
 * @returns {{ data: any, fresh: boolean, age: number } | null}
 *   data: cached payload (even if expired, for stale-while-revalidate)
 *   fresh: true if within TTL
 *   age: ms since it was written
 */
export function getCache(key, ttl) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    const age = Date.now() - t;
    return { data: v, fresh: age < ttl, age };
  } catch {
    return null;
  }
}

/** Write a value to localStorage with current timestamp. */
export function setCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // quota exceeded -> drop oldest ii_cache_ entries
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
      keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch {
      // ignore
    }
  }
}

/** Remove one or all cache entries. */
export function clearCache(key) {
  try {
    if (key) {
      localStorage.removeItem(PREFIX + key);
    } else {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
}
