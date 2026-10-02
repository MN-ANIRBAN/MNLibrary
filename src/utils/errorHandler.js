/**
 * errorHandler.js – Safe error messaging utilities.
 *
 * NEVER pass raw error.message directly to toast/UI.
 * Always call getUserFacingError(err) first to get a sanitized message,
 * while the full error is logged to the console for debugging.
 */

// ── Supabase / Auth Error Code Mappings ──────────────────────────────────

const AUTH_ERROR_MAP = {
  'invalid_credentials': 'Invalid email or password.',
  'email_not_confirmed': 'Please confirm your email address before signing in.',
  'user_already_exists': 'An account with this email already exists.',
  'weak_password': 'Password is too weak. Please choose a stronger password.',
  'over_email_send_rate_limit': 'Too many email requests. Please wait a moment and try again.',
  'otp_expired': 'Your reset link has expired. Please request a new one.',
  'user_not_found': 'No account found with this email address.',
  'session_not_found': 'Your session has expired. Please sign in again.',
  'signup_disabled': 'New registrations are currently disabled.',
};

const HTTP_ERROR_MAP = {
  400: 'Invalid request. Please check your input.',
  401: 'You are not authorised to perform this action.',
  403: 'Access denied.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred. The item may already exist.',
  422: 'The data provided is invalid.',
  429: 'Too many requests. Please slow down and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Service temporarily unavailable. Please try again.',
  503: 'Service temporarily unavailable. Please try again.',
};

const DB_ERROR_PATTERNS = [
  { pattern: /duplicate key/i, message: 'This item already exists.' },
  { pattern: /foreign key/i, message: 'This action is not allowed due to related data.' },
  { pattern: /permission denied/i, message: 'You do not have permission to perform this action.' },
  { pattern: /jwt expired/i, message: 'Your session has expired. Please sign in again.' },
  { pattern: /jwt/i, message: 'Authentication error. Please sign in again.' },
  { pattern: /row.level security/i, message: 'Access denied.' },
  { pattern: /timeout/i, message: 'The request timed out. Please try again.' },
  { pattern: /network/i, message: 'Network error. Please check your connection.' },
  { pattern: /failed to fetch/i, message: 'Unable to connect. Please check your internet connection.' },
];

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// ── Core Function ─────────────────────────────────────────────────────────

/**
 * Returns a safe, user-facing error message for the given error object.
 * Full error details are logged to the console.
 *
 * @param {unknown} err – Any error (Error, Supabase error, string, etc.)
 * @param {string} [context] – Optional context label for the console log
 * @returns {string} A safe, generic error message safe to display in the UI
 */
export function getUserFacingError(err, context = '') {
  // Always log the full error for debugging
  console.error(`[Error${context ? ` in ${context}` : ''}]`, err);

  if (!err) return GENERIC_MESSAGE;

  // Supabase auth errors have a `code` field
  if (err.code && AUTH_ERROR_MAP[err.code]) {
    return AUTH_ERROR_MAP[err.code];
  }

  // Supabase errors also carry `error_description`
  if (err.error_description && AUTH_ERROR_MAP[err.error_description]) {
    return AUTH_ERROR_MAP[err.error_description];
  }

  // HTTP status code errors
  if (err.status && HTTP_ERROR_MAP[err.status]) {
    return HTTP_ERROR_MAP[err.status];
  }

  // Match raw message against known dangerous patterns
  const rawMessage = err.message || (typeof err === 'string' ? err : '');
  for (const { pattern, message } of DB_ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) return message;
  }

  // Special known user-facing messages from our own code (not from the DB)
  if (rawMessage === 'RPC_MISSING_BOOKS' || rawMessage === 'RPC_MISSING_BULKLOGS') {
    return 'Database configuration error. Please contact support.';
  }
  if (rawMessage.startsWith('ImgBB API key')) {
    return 'Image upload service is not configured. Please contact support.';
  }

  // Check if the message looks internal (contains paths, SQL keywords, etc.)
  const looksInternal =
    /at (line|column|row|position)/i.test(rawMessage) ||
    /sql|postgres|relation|table|column|syntax error/i.test(rawMessage) ||
    rawMessage.includes('\\') || // Windows path
    rawMessage.includes('/src/') || // Source path
    rawMessage.includes('stack trace');

  if (looksInternal) return GENERIC_MESSAGE;

  // If the message is short and looks like a known user-facing message, use it
  if (rawMessage && rawMessage.length < 120 && !looksInternal) {
    return rawMessage;
  }

  return GENERIC_MESSAGE;
}

/**
 * Wraps an async function so any thrown errors are automatically logged
 * and converted to user-facing messages via a toast callback.
 *
 * @param {() => Promise<T>} fn
 * @param {(msg: string) => void} onError – e.g., toast.error
 * @param {string} [context]
 * @returns {Promise<T | undefined>}
 */
export async function safeAsync(fn, onError, context = '') {
  try {
    return await fn();
  } catch (err) {
    const msg = getUserFacingError(err, context);
    if (onError) onError(msg);
  }
}
