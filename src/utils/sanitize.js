import DOMPurify from 'dompurify';

/**
 * Sanitizes a string input using DOMPurify to prevent XSS attacks.
 * @param {string} input - The input string to sanitize.
 * @returns {string} - The sanitized string.
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  // We can trim and sanitize
  return DOMPurify.sanitize(input.trim());
};

/**
 * Recursively sanitizes all string values within an object or array.
 * @param {any} data - The data to sanitize.
 * @returns {any} - The sanitized data.
 */
export const sanitizeData = (data) => {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitizedObj = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitizedObj[key] = sanitizeData(data[key]);
      }
    }
    return sanitizedObj;
  }
  
  return data;
};
