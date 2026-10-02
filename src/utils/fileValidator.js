/**
 * fileValidator.js – Secure file upload validation.
 *
 * Security principle: NEVER trust file extensions or the browser-reported
 * MIME type alone. Verify the actual file signature (magic bytes) by reading
 * the first bytes of the file content.
 *
 * Also enforces a configurable maximum file size.
 */

import { FILE_UPLOAD } from '../config/security';

// ── Magic Byte Signatures ─────────────────────────────────────────────────

/**
 * Known magic byte signatures for allowed image formats.
 * Each entry: { mimeType, offset, bytes }
 */
const IMAGE_SIGNATURES = [
  // JPEG: FF D8 FF
  { mimeType: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mimeType: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // GIF87a or GIF89a
  { mimeType: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: RIFF....WEBP
  { mimeType: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
];

/**
 * Reads the first N bytes of a File as a Uint8Array.
 * @param {File|Blob} file
 * @param {number} numBytes
 * @returns {Promise<Uint8Array>}
 */
function readMagicBytes(file, numBytes = 12) {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, numBytes);
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Returns true if the Uint8Array starts with the given byte sequence at offset.
 */
function matchesSignature(bytes, signature) {
  for (let i = 0; i < signature.bytes.length; i++) {
    if (bytes[signature.offset + i] !== signature.bytes[i]) return false;
  }
  return true;
}

// ── Main Validator ────────────────────────────────────────────────────────

/**
 * Validates an image file for upload.
 *
 * Checks:
 * 1. File is defined
 * 2. MIME type is in the allowed list
 * 3. File size is within the configured limit
 * 4. Magic bytes match the reported type (no disguised files)
 *
 * @param {File|Blob} file
 * @returns {Promise<{ valid: boolean, error: string | null }>}
 */
export async function validateImageFile(file) {
  // 1. Existence check
  if (!file) return { valid: false, error: 'No file provided.' };

  const { MAX_SIZE_BYTES, ALLOWED_TYPES } = FILE_UPLOAD;

  // 2. MIME type check (first-pass, browser-reported)
  const reportedType = file.type?.toLowerCase();
  if (!reportedType || !ALLOWED_TYPES.includes(reportedType)) {
    return {
      valid: false,
      error: `File type not allowed. Accepted: ${ALLOWED_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')}.`,
    };
  }

  // 3. Size check
  if (file.size > MAX_SIZE_BYTES) {
    const limitMB = (MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${fileMB} MB). Maximum allowed: ${limitMB} MB.`,
    };
  }

  // 4. Magic bytes check
  try {
    const magicBytes = await readMagicBytes(file, 12);

    // Find signatures matching the reported MIME type
    const signaturesForType = IMAGE_SIGNATURES.filter(s => s.mimeType === reportedType);

    if (signaturesForType.length === 0) {
      // No known signature to verify against; fall back to trusting MIME type
      return { valid: true, error: null };
    }

    const signatureMatched = signaturesForType.some(sig => matchesSignature(magicBytes, sig));

    if (!signatureMatched) {
      // WebP extra check: bytes 8-11 should be "WEBP"
      if (reportedType === 'image/webp') {
        const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
        const hasWebpMarker = webpMarker.every((b, i) => magicBytes[8 + i] === b);
        if (!hasWebpMarker) {
          return { valid: false, error: 'File content does not match its type. Upload rejected.' };
        }
      } else {
        return { valid: false, error: 'File content does not match its type. Upload rejected.' };
      }
    }
  } catch {
    // If we can't read magic bytes, fail safe (reject)
    return { valid: false, error: 'Unable to verify file content. Please try a different file.' };
  }

  return { valid: true, error: null };
}

/**
 * Synchronous quick-check for file size only (for inline UI feedback).
 * @param {File|Blob} file
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateFileSizeSync(file) {
  if (!file) return { valid: false, error: 'No file provided.' };
  const { MAX_SIZE_BYTES } = FILE_UPLOAD;
  if (file.size > MAX_SIZE_BYTES) {
    const limitMB = (MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File too large (${fileMB} MB). Max: ${limitMB} MB.` };
  }
  return { valid: true, error: null };
}
