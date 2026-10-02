/**
 * validation.js – Strict schema-based input validation.
 *
 * Each function returns { valid: boolean, error: string | null }.
 * Call these BEFORE sanitizing or sending data to the backend.
 * Reject (don't just sanitize) anything that doesn't match the schema.
 */

import { INPUT_LIMITS } from '../config/security';

// ── Helpers ──────────────────────────────────────────────────────────────

const ok = () => ({ valid: true, error: null });
const fail = (error) => ({ valid: false, error });

const isString = (v) => typeof v === 'string';
const isEmpty = (v) => !v || (isString(v) && v.trim() === '');

// ── Auth Validators ───────────────────────────────────────────────────────

/**
 * Validates an email address.
 * @param {string} value
 */
export function validateEmail(value) {
  if (isEmpty(value)) return fail('Email is required.');
  if (!isString(value)) return fail('Email must be a string.');
  const trimmed = value.trim();
  if (trimmed.length > INPUT_LIMITS.EMAIL_MAX)
    return fail(`Email must not exceed ${INPUT_LIMITS.EMAIL_MAX} characters.`);
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) return fail('Please enter a valid email address.');
  return ok();
}

/**
 * Validates a password.
 * @param {string} value
 */
export function validatePassword(value) {
  if (isEmpty(value)) return fail('Password is required.');
  if (!isString(value)) return fail('Password must be a string.');
  if (value.length < INPUT_LIMITS.PASSWORD_MIN)
    return fail(`Password must be at least ${INPUT_LIMITS.PASSWORD_MIN} characters.`);
  if (value.length > INPUT_LIMITS.PASSWORD_MAX)
    return fail(`Password must not exceed ${INPUT_LIMITS.PASSWORD_MAX} characters.`);
  if (!/[a-zA-Z]/.test(value)) return fail('Password must contain at least one letter.');
  if (!/[0-9]/.test(value)) return fail('Password must contain at least one number.');
  return ok();
}

/**
 * Validates a display name.
 * @param {string} value
 */
export function validateDisplayName(value) {
  if (isEmpty(value)) return fail('Name is required.');
  if (!isString(value)) return fail('Name must be a string.');
  const trimmed = value.trim();
  if (trimmed.length < 1) return fail('Name cannot be empty.');
  if (trimmed.length > INPUT_LIMITS.NAME_MAX)
    return fail(`Name must not exceed ${INPUT_LIMITS.NAME_MAX} characters.`);
  // Block script injection patterns
  if (/<script|javascript:|on\w+=/i.test(trimmed))
    return fail('Name contains invalid characters.');
  return ok();
}

// ── Book Field Validators ─────────────────────────────────────────────────

/**
 * Validates a book title.
 * @param {string} value
 */
export function validateTitle(value) {
  if (isEmpty(value)) return fail('Title is required.');
  if (!isString(value)) return fail('Title must be a string.');
  if (value.trim().length > INPUT_LIMITS.TITLE_MAX)
    return fail(`Title must not exceed ${INPUT_LIMITS.TITLE_MAX} characters.`);
  return ok();
}

/**
 * Validates an author name.
 * @param {string} value
 */
export function validateAuthor(value) {
  if (isEmpty(value)) return fail('Author is required.');
  if (!isString(value)) return fail('Author must be a string.');
  if (value.trim().length > INPUT_LIMITS.AUTHOR_MAX)
    return fail(`Author must not exceed ${INPUT_LIMITS.AUTHOR_MAX} characters.`);
  return ok();
}

/**
 * Validates an ISBN (10 or 13 digits, hyphens allowed).
 * @param {string} value
 */
export function validateISBN(value) {
  if (isEmpty(value)) return ok(); // ISBN is optional
  if (!isString(value)) return fail('ISBN must be a string.');
  const digits = value.replace(/[-\s]/g, '');
  if (!/^\d{10}(\d{3})?$/.test(digits))
    return fail('ISBN must be 10 or 13 digits.');
  return ok();
}

/**
 * Validates a publication year.
 * @param {string|number} value
 */
export function validateYear(value) {
  if (isEmpty(String(value))) return ok(); // optional
  const num = Number(value);
  if (!Number.isInteger(num) || num < INPUT_LIMITS.YEAR_MIN || num > INPUT_LIMITS.YEAR_MAX)
    return fail(`Year must be between ${INPUT_LIMITS.YEAR_MIN} and ${INPUT_LIMITS.YEAR_MAX}.`);
  return ok();
}

/**
 * Validates page count.
 * @param {string|number} value
 */
export function validatePages(value) {
  if (isEmpty(String(value))) return ok(); // optional
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > INPUT_LIMITS.PAGES_MAX)
    return fail(`Pages must be a whole number between 1 and ${INPUT_LIMITS.PAGES_MAX}.`);
  return ok();
}

/**
 * Validates a price value.
 * @param {string|number} value
 */
export function validatePrice(value) {
  if (isEmpty(String(value))) return ok(); // optional
  const num = Number(value);
  if (isNaN(num) || num < 0 || num > INPUT_LIMITS.PRICE_MAX)
    return fail(`Price must be a non-negative number up to ${INPUT_LIMITS.PRICE_MAX}.`);
  return ok();
}

/**
 * Validates a discount percentage (0–100).
 * @param {string|number} value
 */
export function validateDiscount(value) {
  if (isEmpty(String(value))) return ok(); // optional
  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 100)
    return fail('Discount must be between 0 and 100.');
  return ok();
}

/**
 * Validates a publisher name.
 * @param {string} value
 */
export function validatePublisher(value) {
  if (isEmpty(value)) return ok(); // optional
  if (!isString(value)) return fail('Publisher must be a string.');
  if (value.trim().length > INPUT_LIMITS.PUBLISHER_MAX)
    return fail(`Publisher must not exceed ${INPUT_LIMITS.PUBLISHER_MAX} characters.`);
  return ok();
}

/**
 * Validates notes/description text.
 * @param {string} value
 * @param {'notes'|'description'} field
 */
export function validateTextarea(value, field = 'notes') {
  if (isEmpty(value)) return ok(); // optional
  if (!isString(value)) return fail(`${field} must be a string.`);
  const limit = field === 'description' ? INPUT_LIMITS.DESCRIPTION_MAX : INPUT_LIMITS.NOTES_MAX;
  if (value.length > limit)
    return fail(`${field === 'description' ? 'Description' : 'Notes'} must not exceed ${limit} characters.`);
  return ok();
}

/**
 * Validates a URL (must be https).
 * @param {string} value
 */
export function validateUrl(value) {
  if (isEmpty(value)) return ok(); // optional
  if (!isString(value)) return fail('URL must be a string.');
  if (value.length > INPUT_LIMITS.URL_MAX)
    return fail(`URL must not exceed ${INPUT_LIMITS.URL_MAX} characters.`);
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol))
      return fail('URL must start with http:// or https://.');
  } catch {
    return fail('Please enter a valid URL.');
  }
  return ok();
}

// ── Full Book Form Validator ──────────────────────────────────────────────

/**
 * Validates all fields of a book form payload.
 * Returns an object of field errors, empty object means all valid.
 *
 * @param {object} form
 * @returns {{ [field: string]: string }}
 */
export function validateBookForm(form) {
  const errors = {};
  const check = (field, result) => { if (!result.valid) errors[field] = result.error; };

  check('title', validateTitle(form.title));
  check('author', validateAuthor(form.author));
  check('isbn', validateISBN(form.isbn));
  check('year', validateYear(form.year));
  check('pages', validatePages(form.pages));
  check('price', validatePrice(form.price));
  check('discount', validateDiscount(form.discount));
  check('publisher', validatePublisher(form.publisher));
  check('notes', validateTextarea(form.notes, 'notes'));
  check('description', validateTextarea(form.description, 'description'));

  return errors;
}
