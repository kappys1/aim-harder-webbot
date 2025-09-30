/**
 * Fingerprint utility for generating and managing unique browser identifiers
 * Based on Aimharder's fingerprint generation system
 */

const FINGERPRINT_KEY = 'fingerprint';
const FINGERPRINT_LENGTH = 50;

/**
 * Generates or retrieves the browser fingerprint
 *
 * This function follows Aimharder's implementation:
 * - Generates a 50-character unique identifier
 * - Stores it in localStorage for persistence
 * - Returns the same fingerprint on subsequent calls
 *
 * @returns A 50-character unique fingerprint string
 */
export function generateFingerprint(): string {
  // Check if running in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Return a default fingerprint for server-side rendering
    return 'server-side-fingerprint-' + Math.random().toString(36).substr(2, 27);
  }

  // Check if fingerprint already exists in localStorage
  let fingerprint = localStorage.getItem(FINGERPRINT_KEY);

  // If no fingerprint exists, generate a new one
  if (!fingerprint) {
    fingerprint = '';

    // Generate a 50-character identifier
    while (fingerprint.length < FINGERPRINT_LENGTH) {
      // Add random alphanumeric strings until we reach 50 characters
      fingerprint += Math.random().toString(36).substr(2);
    }

    // Trim to exactly 50 characters
    fingerprint = fingerprint.substr(0, FINGERPRINT_LENGTH);

    // Store the fingerprint in localStorage
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);

    console.log('New fingerprint generated and stored:', fingerprint);
  } else {
    console.log('Existing fingerprint retrieved:', fingerprint);
  }

  return fingerprint;
}

/**
 * Clears the stored fingerprint (useful for testing or logout)
 */
export function clearFingerprint(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(FINGERPRINT_KEY);
    console.log('Fingerprint cleared from localStorage');
  }
}

/**
 * Gets the current fingerprint without generating a new one
 * @returns The stored fingerprint or null if none exists
 */
export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(FINGERPRINT_KEY);
}