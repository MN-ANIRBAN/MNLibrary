/**
 * security.js – Central, environment-driven security configuration.
 *
 * All thresholds are read from VITE_* env vars so they are configurable
 * per-environment without touching source code.
 *
 * To override, add the desired VITE_ key to your .env file.
 */

const parseEnvInt = (key, defaultValue) => {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseEnvList = (key, defaultValue) => {
  const raw = import.meta.env[key];
  if (!raw) return defaultValue;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

// ── Auth Route Rate Limiting ────────────────────────────────────────────────
export const AUTH_RATE_LIMIT = {
  /** Max failed auth attempts before backoff is applied. */
  MAX_ATTEMPTS: parseEnvInt('VITE_RATE_LIMIT_AUTH_MAX_ATTEMPTS', 5),
  /** Sliding window in milliseconds (default 15 minutes). */
  WINDOW_MS: parseEnvInt('VITE_RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
  /** Base delay in ms for exponential backoff after max attempts. */
  BACKOFF_BASE_MS: parseEnvInt('VITE_RATE_LIMIT_AUTH_BACKOFF_BASE_MS', 1000),
};

// ── Public / Unauthenticated Endpoints ────────────────────────────────────
export const PUBLIC_RATE_LIMIT = {
  MAX_REQUESTS: parseEnvInt('VITE_RATE_LIMIT_PUBLIC_MAX', 30),
  WINDOW_MS: parseEnvInt('VITE_RATE_LIMIT_PUBLIC_WINDOW_MS', 60 * 1000),
};

// ── Authenticated User Actions ─────────────────────────────────────────────
export const USER_RATE_LIMIT = {
  MAX_REQUESTS: parseEnvInt('VITE_RATE_LIMIT_AUTH_USER_MAX', 100),
  WINDOW_MS: parseEnvInt('VITE_RATE_LIMIT_USER_WINDOW_MS', 60 * 1000),
};

// ── File Upload ───────────────────────────────────────────────────────────
export const FILE_UPLOAD = {
  /** Maximum file size in bytes (default 5 MB). */
  MAX_SIZE_BYTES: parseEnvInt('VITE_MAX_FILE_SIZE_BYTES', 5 * 1024 * 1024),
  /** Allowed MIME types. */
  ALLOWED_TYPES: parseEnvList(
    'VITE_ALLOWED_IMAGE_TYPES',
    ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ),
};

// ── Input Validation Limits ────────────────────────────────────────────────
export const INPUT_LIMITS = {
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  NAME_MAX: 100,
  TITLE_MAX: 300,
  AUTHOR_MAX: 200,
  PUBLISHER_MAX: 200,
  NOTES_MAX: 2000,
  DESCRIPTION_MAX: 3000,
  PAGES_MAX: 99999,
  YEAR_MIN: 1000,
  YEAR_MAX: new Date().getFullYear() + 1,
  PRICE_MAX: 1_000_000,
  URL_MAX: 2048,
};

// ── Cache ─────────────────────────────────────────────────────────────────
export const CACHE = {
  /** Books cache TTL in ms (default 5 minutes). */
  BOOKS_TTL_MS: parseEnvInt('VITE_CACHE_BOOKS_TTL_MS', 5 * 60 * 1000),
};

// ── Realtime ──────────────────────────────────────────────────────────────
export const REALTIME = {
  /** Base reconnection delay in ms. */
  RECONNECT_BASE_MS: parseEnvInt('VITE_REALTIME_RECONNECT_BASE_MS', 2000),
  /** Maximum reconnection attempts before giving up. */
  MAX_RECONNECT_ATTEMPTS: parseEnvInt('VITE_REALTIME_MAX_RECONNECT', 5),
};
