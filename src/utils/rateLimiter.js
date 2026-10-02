/**
 * rateLimiter.js – Client-side rate limiting utilities.
 *
 * Architecture note: This is a frontend-only app; true IP-based rate
 * limiting lives on Supabase's infrastructure. This module adds a
 * client-side guard to:
 *   1. Prevent accidental rapid-fire calls from buggy UI state.
 *   2. Apply exponential backoff to auth actions per-identifier (email).
 *   3. Give users a clear, friendly wait message instead of a hard lockout.
 *
 * Storage: in-memory Maps only – cleared on page refresh. This avoids
 * localStorage manipulation bypasses.
 */

import { AUTH_RATE_LIMIT, PUBLIC_RATE_LIMIT, USER_RATE_LIMIT } from '../config/security';

// ── Auth Limiter (per email identifier) ──────────────────────────────────

/** Map<identifier, { attempts: number[], lockedUntil: number }> */
const authStore = new Map();

/**
 * Records an auth attempt for the given identifier and checks if it should
 * be allowed.
 *
 * @param {string} identifier – Usually the email address.
 * @returns {{ allowed: boolean, waitMs: number, attemptsLeft: number }}
 */
export function checkAuthRateLimit(identifier) {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const { MAX_ATTEMPTS, WINDOW_MS, BACKOFF_BASE_MS } = AUTH_RATE_LIMIT;

  if (!authStore.has(key)) {
    authStore.set(key, { attempts: [], lockedUntil: 0 });
  }

  const record = authStore.get(key);

  // If within a backoff lock period, deny immediately
  if (record.lockedUntil > now) {
    return {
      allowed: false,
      waitMs: record.lockedUntil - now,
      attemptsLeft: 0,
    };
  }

  // Prune attempts outside the sliding window
  record.attempts = record.attempts.filter((t) => now - t < WINDOW_MS);

  if (record.attempts.length >= MAX_ATTEMPTS) {
    // Calculate exponential backoff: base * 2^(extra attempts above limit)
    const extra = record.attempts.length - MAX_ATTEMPTS + 1;
    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, Math.min(extra, 8)); // cap at 2^8
    record.lockedUntil = now + backoffMs;
    return {
      allowed: false,
      waitMs: backoffMs,
      attemptsLeft: 0,
    };
  }

  const attemptsLeft = MAX_ATTEMPTS - record.attempts.length - 1;
  return { allowed: true, waitMs: 0, attemptsLeft };
}

/**
 * Records a completed auth attempt (call after the Supabase call, success or fail).
 * Only counts failed attempts against the limit.
 *
 * @param {string} identifier
 * @param {boolean} success – true if auth succeeded (clears the record)
 */
export function recordAuthAttempt(identifier, success) {
  const key = identifier.toLowerCase().trim();
  if (success) {
    authStore.delete(key); // Reset on success
    return;
  }
  const record = authStore.get(key) || { attempts: [], lockedUntil: 0 };
  record.attempts.push(Date.now());
  authStore.set(key, record);
}

/**
 * Returns a human-readable wait string.
 * @param {number} waitMs
 */
export function formatWaitTime(waitMs) {
  const seconds = Math.ceil(waitMs / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

// ── Bucket Limiter (for public / authenticated general endpoints) ──────────

/**
 * A simple token-bucket limiter stored in memory.
 */
class BucketLimiter {
  constructor({ maxRequests, windowMs }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    /** @type {Map<string, number[]>} */
    this.store = new Map();
  }

  /**
   * @param {string} key – Bucket key (e.g. userId or 'public')
   * @returns {boolean} true if the request is allowed
   */
  check(key) {
    const now = Date.now();
    if (!this.store.has(key)) this.store.set(key, []);
    const timestamps = this.store.get(key).filter((t) => now - t < this.windowMs);
    timestamps.push(now);
    this.store.set(key, timestamps);
    return timestamps.length <= this.maxRequests;
  }
}

export const publicLimiter = new BucketLimiter(PUBLIC_RATE_LIMIT);
export const userLimiter = new BucketLimiter(USER_RATE_LIMIT);
