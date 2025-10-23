/**
 * Utility functions for parsing AimHarder error messages
 * and calculating exact timestamps for pre-bookings
 *
 * Note: Frontend now calculates UTC times, so backend only needs to subtract days
 */
import { sub } from 'date-fns';

export interface ParsedEarlyBookingError {
  availableAt: Date;
  daysAdvance: number;
  classDate: Date;
}

/**
 * Parses AimHarder early booking error message and calculates
 * the exact timestamp when booking becomes available
 *
 * Frontend now calculates the UTC time correctly (using browser timezone),
 * so the backend just receives the UTC Date object and subtracts the days.
 *
 * @param errorMessage - Error message from AimHarder API (e.g., "No puedes reservar clases con más de 4 días de antelación")
 * @param classDay - Day of the class in YYYYMMDD format (e.g., "20250214") - used only for validation/logging
 * @param classTimeUTC - Date object already in UTC (optional). If not provided, uses 00:00 UTC on classDay
 * @returns Parsed error with exact availableAt timestamp in UTC
 *
 * @example
 * // Class is Friday 14th at 20:30 Madrid time (which is 19:30 UTC), max advance is 4 days
 * const classDateUTC = new Date("2025-02-14T19:30:00.000Z");
 * parseEarlyBookingError("No puedes reservar clases con más de 4 días de antelación", "20250214", classDateUTC)
 * // Returns: availableAt = Monday 10th 19:30 UTC (exactly 4 days before Friday 19:30 UTC)
 */
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC?: Date
): ParsedEarlyBookingError | null {
  if (!errorMessage) return null;

  // Extract days advance from Spanish error message
  // Pattern: "con más de X días de antelación"
  const daysMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/i);

  if (!daysMatch) {
    console.warn('[PreBooking] Could not extract days from error message:', errorMessage);
    return null;
  }

  const daysAdvance = parseInt(daysMatch[1], 10);

  // Use the classTimeUTC directly (already in UTC from frontend)
  // If not provided, create a UTC Date at 00:00 for the class day
  let classDateUTC: Date;

  if (classTimeUTC && classTimeUTC instanceof Date && !isNaN(classTimeUTC.getTime())) {
    classDateUTC = classTimeUTC;
  } else {
    // Fallback: parse classDay and use 00:00 UTC
    console.warn('[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay');
    const classDateParsed = parseDateFromYYYYMMDD(classDay);
    if (!classDateParsed) {
      console.error('[PreBooking] Invalid class date format:', classDay);
      return null;
    }
    // Create UTC date at 00:00
    classDateUTC = new Date(Date.UTC(
      classDateParsed.getFullYear(),
      classDateParsed.getMonth(),
      classDateParsed.getDate(),
      0,
      0,
      0
    ));
  }

  // Calculate available date (subtract days)
  const availableAt = sub(classDateUTC, { days: daysAdvance });

  return {
    availableAt,
    daysAdvance,
    classDate: classDateUTC,
  };
}

/**
 * Parses date from YYYYMMDD format to Date object
 *
 * @param dateString - Date in YYYYMMDD format (e.g., "20250214")
 * @returns Date object or null if invalid
 */
export function parseDateFromYYYYMMDD(dateString: string): Date | null {
  if (!/^\d{8}$/.test(dateString)) {
    return null;
  }

  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(dateString.substring(6, 8), 10);

  const date = new Date(year, month, day);

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Formats a Date object to YYYYMMDD format
 *
 * @param date - Date object
 * @returns Date string in YYYYMMDD format
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Calculates how many milliseconds until a timestamp
 *
 * @param targetDate - Target date
 * @returns Milliseconds until target date (negative if in the past)
 */
export function millisecondsUntil(targetDate: Date): number {
  return targetDate.getTime() - Date.now();
}

/**
 * Checks if a timestamp is within the next N minutes
 *
 * @param targetDate - Target date
 * @param minutes - Number of minutes
 * @returns True if target is within the next N minutes
 */
export function isWithinNextMinutes(targetDate: Date, minutes: number): boolean {
  const ms = millisecondsUntil(targetDate);
  return ms > 0 && ms <= minutes * 60 * 1000;
}

/**
 * Formats a human-readable countdown string
 *
 * @param targetDate - Target date
 * @returns Human-readable string (e.g., "2 days, 3 hours", "45 minutes", "5 seconds")
 */
export function formatCountdown(targetDate: Date): string {
  const ms = millisecondsUntil(targetDate);

  if (ms < 0) {
    return 'Tiempo agotado';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days} día${days > 1 ? 's' : ''}${remainingHours > 0 ? `, ${remainingHours} hora${remainingHours > 1 ? 's' : ''}` : ''}`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hora${hours > 1 ? 's' : ''}${remainingMinutes > 0 ? `, ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}` : ''}`;
  }

  if (minutes > 0) {
    return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }

  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}