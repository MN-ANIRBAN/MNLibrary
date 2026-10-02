/**
 * useDebounce.js – Debounce hook.
 *
 * Returns a debounced version of the value that only updates after
 * the specified delay has passed without another change.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery, 300);
 *   // debouncedSearch updates 300ms after searchQuery stops changing
 */

import { useState, useEffect } from 'react';

/**
 * @template T
 * @param {T} value – The value to debounce
 * @param {number} [delay=300] – Debounce delay in milliseconds
 * @returns {T} The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
