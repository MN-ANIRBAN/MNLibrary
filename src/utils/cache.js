/**
 * cache.js – TTL-aware localStorage cache.
 *
 * Each cached item is stored as JSON: { data, expiresAt }.
 * Expired items are treated as cache misses and cleared on read.
 */

const PREFIX = 'mnlib_cache_';

// ── Core API ─────────────────────────────────────────────────────────────

/**
 * Stores data in the cache with a TTL.
 *
 * @param {string} key
 * @param {unknown} data – Serialisable data
 * @param {number} ttlMs – Time to live in milliseconds
 */
export function cacheSet(key, data, ttlMs) {
  try {
    const entry = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // localStorage quota exceeded or unavailable — fail silently
    console.warn('[cache] Failed to write:', key, e);
  }
}

/**
 * Retrieves data from the cache.
 * Returns null if the key doesn't exist or the entry is expired.
 *
 * @param {string} key
 * @returns {unknown | null}
 */
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch (e) {
    console.warn('[cache] Failed to read:', key, e);
    return null;
  }
}

/**
 * Removes a specific key from the cache.
 * @param {string} key
 */
export function cacheInvalidate(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Removes all cache keys matching a prefix pattern.
 * @param {string} pattern – Prefix string to match (without the global PREFIX)
 */
export function cacheInvalidatePattern(pattern) {
  try {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + pattern)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Clears all MN Library cache entries.
 */
export function cacheClearAll() {
  try {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ── Convenience Keys ──────────────────────────────────────────────────────

export const cacheKeys = {
  books:       (userId) => `books_${userId}`,
  binBooks:    (userId) => `binBooks_${userId}`,
  userProfile: (userId) => `userProfile_${userId}`,
  groupData:   (userId) => `groupData_${userId}`,
};

