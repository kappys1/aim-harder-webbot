/**
 * Utility functions for parsing AimHarder error messages
 * and calculating exact timestamps for pre-bookings
 *
 * CRITICAL: Calculates availableAt in LOCAL box timezone
 * This ensures that when a class is at 08:00 local time, the availability
 * is ALSO at 08:00 local time (days before), even across DST boundaries.
 *
 * Example (Madrid timezone, UTC+1 in winter, UTC+2 in summer):
 * - Class: Oct 28, 08:00 Madrid (UTC+1) = 07:00 UTC
 * - Available: Oct 24, 08:00 Madrid (UTC+2) = 06:00 UTC ← Same local time!
 *
 * Phase 2: Now supports multiple timezones per box via boxTimezone parameter
 * Each box can specify its own IANA timezone (e.g., Europe/Madrid, America/New_York)
 *
 * This is the correct behavior for "reserve in box timezone, not user timezone"
 */
import { fromZonedTime, toZonedTime } from "date-fns-tz";

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
 * @param boxTimezone - IANA timezone string for the box (e.g., "Europe/Madrid", "America/New_York"). Defaults to "Europe/Madrid"
 * @returns Parsed error with exact availableAt timestamp in UTC
 *
 * @example
 * // Class is Friday 14th at 20:30 Madrid time (which is 19:30 UTC), max advance is 4 days
 * const classDateUTC = new Date("2025-02-14T19:30:00.000Z");
 * parseEarlyBookingError("No puedes reservar clases con más de 4 días de antelación", "20250214", classDateUTC, "Europe/Madrid")
 * // Returns: availableAt = Monday 10th 19:30 UTC (exactly 4 days before Friday 19:30 UTC)
 */
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC?: Date,
  boxTimezone: string = "Europe/Madrid"
): ParsedEarlyBookingError | null {
  if (!errorMessage) return null;

  // Extract days advance from Spanish/Catalan/English error message
  // We try multiple patterns to support all languages

  let daysAdvance: number | null = null;

  // Pattern 1 (Spanish): "con más de X días de antelación"
  // Example: "No puedes reservar clases con más de 4 días de antelación"
  const spanishMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/i);

  // Pattern 2 (Catalan): "amb més de X dies d'antelació"
  // Example: "No pots reservar classes amb més de 4 dies d'antelació"
  // More flexible: accepts any character (including different apostrophes) between 'd' and 'antelació'
  const catalanMatch = errorMessage.match(/(\d+)\s+dies\s+d.antelació/i);

  // Pattern 3 (English): "with more than X days of anticipation" or "with more than X days in advance"
  // Example: "You can't book classes with more than 4 days of anticipation"
  const englishMatch = errorMessage.match(
    /(\d+)\s+days?\s+(?:of\s+anticipation|in\s+advance|of\s+advance)/i
  );

  if (spanishMatch) {
    daysAdvance = parseInt(spanishMatch[1], 10);
    console.log("[PreBooking] Matched Spanish pattern:", {
      daysAdvance,
      errorMessage,
    });
  } else if (catalanMatch) {
    daysAdvance = parseInt(catalanMatch[1], 10);
    console.log("[PreBooking] Matched Catalan pattern:", {
      daysAdvance,
      errorMessage,
    });
  } else if (englishMatch) {
    daysAdvance = parseInt(englishMatch[1], 10);
    console.log("[PreBooking] Matched English pattern:", {
      daysAdvance,
      errorMessage,
    });
  } else {
    console.warn(
      "[PreBooking] Could not extract days from error message:",
      errorMessage
    );
    console.warn("[PreBooking] Debug - trying generic number extraction...");
    // Fallback: try to extract any number followed by "dies" or "días" or "days"
    const genericMatch = errorMessage.match(/(\d+)\s+(dies|días?|days?)/i);
    if (genericMatch) {
      daysAdvance = parseInt(genericMatch[1], 10);
      console.log("[PreBooking] Matched generic pattern (fallback):", {
        daysAdvance,
        errorMessage,
      });
    } else {
      return null;
    }
  }

  // Use the classTimeUTC directly (already in UTC from frontend)
  // If not provided, create a UTC Date at 00:00 for the class day
  let classDateUTC: Date;

  if (
    classTimeUTC &&
    classTimeUTC instanceof Date &&
    !isNaN(classTimeUTC.getTime())
  ) {
    classDateUTC = classTimeUTC;
    console.log("[PreBooking] Using provided classTimeUTC:", {
      classTimeUTC: classTimeUTC.toISOString(),
      utcHours: classTimeUTC.getUTCHours(),
      utcMinutes: classTimeUTC.getUTCMinutes(),
    });
  } else {
    // Fallback: parse classDay and use 00:00 UTC
    console.warn(
      "[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay",
      {
        classTimeUTCProvided: !!classTimeUTC,
        classTimeUTCType: classTimeUTC?.constructor?.name,
        classTimeUTCValid:
          classTimeUTC instanceof Date ? !isNaN(classTimeUTC.getTime()) : false,
      }
    );
    const classDateParsed = parseDateFromYYYYMMDD(classDay);
    if (!classDateParsed) {
      console.error("[PreBooking] Invalid class date format:", classDay);
      return null;
    }
    // Create UTC date at 00:00
    classDateUTC = new Date(
      Date.UTC(
        classDateParsed.getFullYear(),
        classDateParsed.getMonth(),
        classDateParsed.getDate(),
        0,
        0,
        0
      )
    );
    console.log("[PreBooking] Created fallback UTC date:", {
      classDateUTC: classDateUTC.toISOString(),
    });
  }

  // Calculate available date (subtract days in LOCAL timezone)
  // CRITICAL: Must calculate in LOCAL box timezone, not UTC
  // This ensures availableAt is at the SAME LOCAL TIME as the class, just days before
  //
  // EXAMPLE - Booking for Oct 28 (UTC+1), available Oct 24 (UTC+2):
  // Wrong (UTC only):  Oct 28 07:00 UTC - 4 days = Oct 24 07:00 UTC = 09:00 local ❌
  // Right (local):     Oct 28 08:00 local - 4 days = Oct 24 08:00 local = 06:00 UTC ✅

  // Convert class time to local timezone to see the actual local time and date
  const classLocal = toZonedTime(classDateUTC, boxTimezone);

  // Create the AVAILABLE date in local timezone:
  // Same year/month/day as the class, but daysAdvance days earlier, with same time
  const availableLocalDate = new Date(classLocal);
  availableLocalDate.setDate(availableLocalDate.getDate() - daysAdvance);

  // Convert back to UTC using the box timezone
  // This automatically applies the correct DST offset for that date
  const availableAt = fromZonedTime(availableLocalDate, boxTimezone);

  console.log("[PreBooking] Calculated availableAt (in local timezone):", {
    classDateUTC: classDateUTC.toISOString(),
    classLocalTime: `${classLocal.getHours()}:${String(
      classLocal.getMinutes()
    ).padStart(2, "0")}`,
    classLocalDate: classLocal.toLocaleDateString("es-ES"),
    daysAdvance,
    availableLocalDate: availableLocalDate.toLocaleDateString("es-ES"),
    availableLocalTime: `${availableLocalDate.getHours()}:${String(
      availableLocalDate.getMinutes()
    ).padStart(2, "0")}`,
    availableAt: availableAt.toISOString(),
    boxTimezone,
    calculationMethod: "local timezone arithmetic (DST-aware)",
  });

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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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
export function isWithinNextMinutes(
  targetDate: Date,
  minutes: number
): boolean {
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
    return "Tiempo agotado";
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days} día${days > 1 ? "s" : ""}${
      remainingHours > 0
        ? `, ${remainingHours} hora${remainingHours > 1 ? "s" : ""}`
        : ""
    }`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hora${hours > 1 ? "s" : ""}${
      remainingMinutes > 0
        ? `, ${remainingMinutes} minuto${remainingMinutes > 1 ? "s" : ""}`
        : ""
    }`;
  }

  if (minutes > 0) {
    return `${minutes} minuto${minutes > 1 ? "s" : ""}`;
  }

  return `${seconds} segundo${seconds !== 1 ? "s" : ""}`;
}
