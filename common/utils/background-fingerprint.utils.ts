/**
 * Background Fingerprint Generation Utility
 *
 * Generates deterministic fingerprints for background sessions.
 *
 * CRITICAL: This MUST be deterministic (same email = same fingerprint)
 * to ensure only ONE background session per user.
 *
 * Design Decision:
 * - NO timestamp included (deterministic)
 * - Uses SHA-256 with server-side salt
 * - Format: bg-{40-char-hex-hash}
 * - Same user always gets same fingerprint
 *
 * Why Deterministic?
 * - Ensures UPSERT works correctly on re-login
 * - Each user has exactly ONE background session
 * - Session is reused and updated, not recreated
 *
 * @see .claude/doc/multi_session_architecture/nextjs_architect.md
 * @see .claude/doc/multi_session_architecture/CHANGES_SUMMARY.md
 */

import crypto from 'crypto';

/**
 * Generates a secure, DETERMINISTIC background session fingerprint
 *
 * @param email - User email address
 * @returns Fingerprint string in format: bg-{40-char-hex}
 *
 * @example
 * const fp1 = generateBackgroundFingerprint('user@example.com');
 * const fp2 = generateBackgroundFingerprint('user@example.com');
 * console.log(fp1 === fp2); // true - SAME fingerprint
 *
 * @example
 * const fp1 = generateBackgroundFingerprint('user1@example.com');
 * const fp2 = generateBackgroundFingerprint('user2@example.com');
 * console.log(fp1 === fp2); // false - DIFFERENT users
 */
export function generateBackgroundFingerprint(email: string): string {
  // Get salt from environment (server-side secret)
  const salt = process.env.BACKGROUND_FINGERPRINT_SALT || 'aimharder-background-v1';

  // CRITICAL: NO timestamp - must be deterministic
  // Normalize email (lowercase + trim) for consistency
  const normalizedEmail = email.toLowerCase().trim();
  const data = `${normalizedEmail}-${salt}`;

  // Generate SHA-256 hash
  const hash = crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');

  // Return first 40 characters with 'bg-' prefix
  return `bg-${hash.substring(0, 40)}`;
}

/**
 * Validates if a fingerprint is a background session fingerprint
 *
 * @param fingerprint - Fingerprint string to validate
 * @returns true if fingerprint matches background pattern
 *
 * @example
 * isBackgroundFingerprint('bg-abc123...'); // true
 * isBackgroundFingerprint('device-xyz789'); // false
 */
export function isBackgroundFingerprint(fingerprint: string): boolean {
  return fingerprint.startsWith('bg-') && fingerprint.length === 43;
}

/**
 * Validates if a fingerprint is a device session fingerprint
 *
 * @param fingerprint - Fingerprint string to validate
 * @returns true if fingerprint does NOT match background pattern
 *
 * @example
 * isDeviceFingerprint('device-xyz789'); // true
 * isDeviceFingerprint('bg-abc123...'); // false
 */
export function isDeviceFingerprint(fingerprint: string): boolean {
  return !isBackgroundFingerprint(fingerprint);
}

/**
 * Gets the session type based on fingerprint pattern
 *
 * @param fingerprint - Fingerprint string
 * @returns 'background' or 'device'
 *
 * @example
 * getSessionTypeFromFingerprint('bg-abc123...'); // 'background'
 * getSessionTypeFromFingerprint('device-xyz789'); // 'device'
 */
export function getSessionTypeFromFingerprint(fingerprint: string): 'background' | 'device' {
  return isBackgroundFingerprint(fingerprint) ? 'background' : 'device';
}
