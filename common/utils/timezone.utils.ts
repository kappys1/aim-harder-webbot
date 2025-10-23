/**
 * Timezone utility functions for converting between local and UTC times
 *
 * These utilities handle timezone-aware date conversions across different regions
 * and daylight saving time transitions automatically.
 *
 * The key principle: Frontend calculates UTC using the browser's actual timezone,
 * then sends ISO 8601 UTC to the backend for storage and calculations.
 */

import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

/**
 * Gets the browser's current timezone
 *
 * Uses Intl API to detect the user's actual timezone
 * with fallback for older browsers
 *
 * @returns IANA timezone string (e.g., "Europe/Madrid", "America/New_York")
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('[Timezone] Browser timezone detection failed, using fallback');
    // Fallback: assume UTC (safest default)
    return 'UTC';
  }
}

/**
 * Converts a local date/time to UTC ISO 8601 string
 *
 * This is the core function used before sending booking requests to the backend.
 * It automatically handles DST transitions by using the browser's actual timezone.
 *
 * @param localDate - Date string in format "YYYY-MM-DD" (e.g., "2025-10-28")
 * @param localTime - Time string in format "HH:mm" (e.g., "08:00")
 * @returns ISO 8601 UTC string (e.g., "2025-10-28T07:00:00.000Z")
 *
 * @example
 * // User in Madrid (Oct 28 = CET = UTC+1)
 * convertLocalToUTC("2025-10-28", "08:00")
 * // Returns: "2025-10-28T07:00:00.000Z"
 *
 * @example
 * // User in Madrid (July 15 = CEST = UTC+2)
 * convertLocalToUTC("2025-07-15", "08:00")
 * // Returns: "2025-07-15T06:00:00.000Z"
 *
 * @example
 * // User in New York (Oct 28 = EDT = UTC-4)
 * convertLocalToUTC("2025-10-28", "08:00")
 * // Returns: "2025-10-28T12:00:00.000Z"
 */
export function convertLocalToUTC(localDate: string, localTime: string): string {
  try {
    const browserTimezone = getBrowserTimezone();

    // Construct full datetime string: "YYYY-MM-DD HH:mm:ss"
    const localDateTime = `${localDate}T${localTime}:00`;

    // Convert local time to UTC using the browser's actual timezone
    // fromZonedTime automatically handles DST for the given date
    const utcDate = fromZonedTime(localDateTime, browserTimezone);

    // Return ISO 8601 UTC string
    return utcDate.toISOString();
  } catch (error) {
    console.error('[Timezone] Error converting local to UTC:', error);
    throw new Error(`Failed to convert local time to UTC: ${error}`);
  }
}

/**
 * Converts a UTC ISO 8601 string to a Date object in the browser's timezone
 *
 * Used when displaying times from the backend (e.g., when a prebooking is available)
 *
 * @param utcDateTime - ISO 8601 UTC string (e.g., "2025-10-28T07:00:00.000Z")
 * @returns Date object in browser timezone context
 *
 * @example
 * const utcString = "2025-10-28T07:00:00.000Z";
 * const localDate = convertUTCToLocal(utcString);
 * // In Madrid: shows 08:00 (CET)
 * // In NYC: shows 03:00 (EDT)
 */
export function convertUTCToLocal(utcDateTime: string): Date {
  try {
    const browserTimezone = getBrowserTimezone();
    return toZonedTime(utcDateTime, browserTimezone);
  } catch (error) {
    console.error('[Timezone] Error converting UTC to local:', error);
    throw new Error(`Failed to convert UTC to local time: ${error}`);
  }
}

/**
 * Formats a UTC datetime string for display in the user's local timezone
 *
 * Useful for showing when a prebooking becomes available
 *
 * @param utcDateTime - ISO 8601 UTC string
 * @param formatStr - date-fns format string (default: "PPp")
 * @returns Formatted string in user's timezone
 *
 * @example
 * formatUTCForDisplay("2025-10-28T07:00:00.000Z")
 * // In Madrid: "martes, 28 de octubre de 2025 8:00 AM"
 */
export function formatUTCForDisplay(
  utcDateTime: string,
  formatStr: string = 'PPp'
): string {
  try {
    const localDate = convertUTCToLocal(utcDateTime);
    return format(localDate, formatStr);
  } catch (error) {
    console.error('[Timezone] Error formatting UTC for display:', error);
    return utcDateTime; // Fallback to ISO string
  }
}

/**
 * Validates that a string is a valid ISO 8601 UTC datetime
 *
 * @param dateString - String to validate
 * @returns true if valid ISO 8601 UTC string, false otherwise
 */
export function isValidUTCDateTime(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.includes('Z');
  } catch {
    return false;
  }
}

/**
 * Gets the current timezone offset in ISO 8601 format
 *
 * Useful for debugging and logging
 *
 * @returns ISO 8601 offset string (e.g., "+01:00", "-04:00")
 */
export function getCurrentTimezoneOffset(): string {
  const now = new Date();
  const browserTimezone = getBrowserTimezone();
  const zonedDate = toZonedTime(now, browserTimezone);
  const offsetMs = -now.getTimezoneOffset() * 60 * 1000;
  const offsetHours = Math.floor(Math.abs(offsetMs) / (60 * 60 * 1000));
  const offsetMinutes = Math.floor((Math.abs(offsetMs) % (60 * 60 * 1000)) / (60 * 1000));
  const offsetSign = offsetMs >= 0 ? '+' : '-';
  return `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
}
