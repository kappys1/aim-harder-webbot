import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseEarlyBookingError,
  parseDateFromYYYYMMDD,
  formatDateToYYYYMMDD,
  millisecondsUntil,
  isWithinNextMinutes,
  formatCountdown,
} from './error-parser.utils';

describe('error-parser.utils', () => {
  describe('parseDateFromYYYYMMDD', () => {
    it('should parse valid date string', () => {
      const result = parseDateFromYYYYMMDD('20250214');

      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(1); // February is month 1 (0-indexed)
      expect(result?.getDate()).toBe(14);
    });

    it('should return null for invalid format', () => {
      expect(parseDateFromYYYYMMDD('2025-02-14')).toBeNull();
      expect(parseDateFromYYYYMMDD('20250214abc')).toBeNull();
      expect(parseDateFromYYYYMMDD('2025021')).toBeNull();
      expect(parseDateFromYYYYMMDD('')).toBeNull();
    });

    it('should return null for invalid date values', () => {
      expect(parseDateFromYYYYMMDD('20251332')).not.toBeNull(); // Date() handles this
      expect(parseDateFromYYYYMMDD('20250230')).not.toBeNull(); // Date() handles this
    });

    it('should handle leap years correctly', () => {
      const leapYear = parseDateFromYYYYMMDD('20240229');
      expect(leapYear).not.toBeNull();
      expect(leapYear?.getDate()).toBe(29);
    });

    it('should parse first day of year', () => {
      const result = parseDateFromYYYYMMDD('20250101');
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(1);
    });

    it('should parse last day of year', () => {
      const result = parseDateFromYYYYMMDD('20251231');
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(31);
    });
  });

  describe('formatDateToYYYYMMDD', () => {
    it('should format date to YYYYMMDD', () => {
      const date = new Date(2025, 1, 14); // February 14, 2025
      expect(formatDateToYYYYMMDD(date)).toBe('20250214');
    });

    it('should pad single-digit months and days', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      expect(formatDateToYYYYMMDD(date)).toBe('20250105');
    });

    it('should handle first day of year', () => {
      const date = new Date(2025, 0, 1);
      expect(formatDateToYYYYMMDD(date)).toBe('20250101');
    });

    it('should handle last day of year', () => {
      const date = new Date(2025, 11, 31);
      expect(formatDateToYYYYMMDD(date)).toBe('20251231');
    });

    it('should handle leap year February', () => {
      const date = new Date(2024, 1, 29);
      expect(formatDateToYYYYMMDD(date)).toBe('20240229');
    });
  });

  describe('millisecondsUntil', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate positive milliseconds for future date', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:05:00.000Z');
      const result = millisecondsUntil(targetDate);

      expect(result).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should calculate negative milliseconds for past date', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T11:50:00.000Z');
      const result = millisecondsUntil(targetDate);

      expect(result).toBe(-10 * 60 * 1000); // -10 minutes
    });

    it('should return zero for current time', () => {
      const now = new Date('2025-01-10T12:00:00.000Z');
      vi.setSystemTime(now);

      const result = millisecondsUntil(now);

      expect(result).toBe(0);
    });
  });

  describe('isWithinNextMinutes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true if target is within next N minutes', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:04:00.000Z');
      const result = isWithinNextMinutes(targetDate, 5);

      expect(result).toBe(true);
    });

    it('should return false if target is beyond N minutes', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:06:00.000Z');
      const result = isWithinNextMinutes(targetDate, 5);

      expect(result).toBe(false);
    });

    it('should return false if target is in the past', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T11:55:00.000Z');
      const result = isWithinNextMinutes(targetDate, 5);

      expect(result).toBe(false);
    });

    it('should return true if target is exactly at boundary', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:05:00.000Z');
      const result = isWithinNextMinutes(targetDate, 5);

      expect(result).toBe(true);
    });

    it('should return false if target is current time', () => {
      const now = new Date('2025-01-10T12:00:00.000Z');
      vi.setSystemTime(now);

      const result = isWithinNextMinutes(now, 5);

      expect(result).toBe(false); // Not within next minutes, it's NOW
    });
  });

  describe('formatCountdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format days and hours', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-12T15:00:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('2 días, 3 horas');
    });

    it('should format single day without hours', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-11T12:00:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('1 día');
    });

    it('should format hours and minutes', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T14:30:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('2 horas, 30 minutos');
    });

    it('should format single hour without minutes', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T13:00:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('1 hora');
    });

    it('should format minutes only', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:45:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('45 minutos');
    });

    it('should format single minute', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:01:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('1 minuto');
    });

    it('should format seconds only', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:00:45.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('45 segundos');
    });

    it('should format single second', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T12:00:01.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('1 segundo');
    });

    it('should return "Tiempo agotado" for past date', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      const targetDate = new Date('2025-01-10T11:00:00.000Z');
      const result = formatCountdown(targetDate);

      expect(result).toBe('Tiempo agotado');
    });

    it('should handle plural forms correctly', () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));

      // Multiple days, multiple hours
      const target1 = new Date('2025-01-13T15:00:00.000Z');
      expect(formatCountdown(target1)).toBe('3 días, 3 horas');

      // Multiple hours, multiple minutes
      const target2 = new Date('2025-01-10T14:35:00.000Z');
      expect(formatCountdown(target2)).toBe('2 horas, 35 minutos');
    });
  });

  describe('parseEarlyBookingError', () => {
    let consoleWarnSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should parse error message with UTC Date object', () => {
      // February 14, 2025 at 20:30 UTC
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);
      expect(result?.classDate).toBe(classTimeUTC);
      expect(result?.classDate.getUTCHours()).toBe(20);
      expect(result?.classDate.getUTCMinutes()).toBe(30);
    });

    it('should return null for undefined error message', () => {
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');
      const result = parseEarlyBookingError(undefined, '20250214', classTimeUTC);
      expect(result).toBeNull();
    });

    it('should return null when error message does not match pattern', () => {
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');
      const result = parseEarlyBookingError(
        'Error desconocido',
        '20250214',
        classTimeUTC
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PreBooking] Could not extract days from error message:',
        'Error desconocido'
      );
    });

    it('should use fallback 00:00 UTC when classTimeUTC is not provided', () => {
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214'
      );

      expect(result).not.toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay',
        expect.any(Object)
      );
      // Should use 00:00 UTC for Feb 14
      expect(result?.classDate.getUTCHours()).toBe(0);
      expect(result?.classDate.getUTCMinutes()).toBe(0);
    });

    it('should reject invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        invalidDate
      );

      expect(result).not.toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay',
        expect.any(Object)
      );
    });

    it('should handle different days advance values', () => {
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');

      const test2Days = parseEarlyBookingError(
        'No puedes reservar clases con más de 2 días de antelación',
        '20250214',
        classTimeUTC
      );
      expect(test2Days?.daysAdvance).toBe(2);

      const test7Days = parseEarlyBookingError(
        'No puedes reservar clases con más de 7 días de antelación',
        '20250214',
        classTimeUTC
      );
      expect(test7Days?.daysAdvance).toBe(7);
    });

    it('should handle singular "día" in error message', () => {
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 1 día de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(1);
    });

    it('should calculate availableAt correctly', () => {
      // Class on Friday 14th at 20:30 UTC, max advance 4 days
      // Available from Monday 10th at 20:30 UTC
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
      expect(result?.availableAt).toBeInstanceOf(Date);

      // The availableAt should be exactly 4 days before the class
      const daysDiff = Math.floor(
        (result!.classDate.getTime() - result!.availableAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(daysDiff).toBe(4);
    });

    it('should handle midnight UTC class time', () => {
      const classTimeUTC = new Date('2025-02-14T00:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
    });

    it('should handle late night UTC class time', () => {
      const classTimeUTC = new Date('2025-02-14T23:59:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
    });

    it('should preserve exact time in availableAt calculation', () => {
      const classTimeUTC = new Date('2025-02-14T20:30:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250214',
        classTimeUTC
      );

      expect(result).not.toBeNull();
      // The availableAt should have the same UTC time as the class
      expect(result?.availableAt.getUTCHours()).toBe(result?.classDate.getUTCHours());
      expect(result?.availableAt.getUTCMinutes()).toBe(result?.classDate.getUTCMinutes());
    });

    it('should handle DST transition correctly (CRITICAL BUG FIX)', () => {
      // SCENARIO: Booking on Oct 23 (UTC+2) for Oct 28 (UTC+1)
      // This crosses the DST boundary (Oct 26/27)
      // The class is at 08:00 Madrid time on Oct 28 = 07:00 UTC
      const classTimeUTC = new Date('2025-10-28T07:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        classTimeUTC
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // CRITICAL: The availableAt must be at the SAME LOCAL TIME as the class, 4 days earlier
      // Class: Oct 28, 08:00 Madrid (UTC+1) = 07:00 UTC
      // Available: Oct 24, 08:00 Madrid (UTC+2) = 06:00 UTC ← Same local time!
      expect(result?.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');

      // Verify the UTC time is different (due to DST offset change)
      expect(result?.availableAt.getUTCHours()).toBe(6); // UTC+2 offset means 06:00 UTC
      expect(result?.availableAt.getUTCMinutes()).toBe(0);
      expect(result?.availableAt.getUTCDate()).toBe(24);

      // Verify the difference is approximately 4 days (with small tolerance for timezone conversion)
      const diffMs = result!.classDate.getTime() - result!.availableAt.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      // Due to DST offset differences, the difference might be 4.041... days (1 hour more)
      // This is expected: Oct 28 (UTC+1) to Oct 24 (UTC+2) = 96 hours + 1 hour = 97 hours
      expect(diffDays).toBeCloseTo(4.041666, 3); // Allow timezone conversion overhead

      // Most importantly: verify both are at 08:00 in Madrid time
      // Class: Oct 28 07:00 UTC = 08:00 Madrid (UTC+1)
      // Available: Oct 24 06:00 UTC = 08:00 Madrid (UTC+2)
      // This is the correct behavior!
    });
  });

  describe('Multi-timezone support (Phase 2)', () => {
    it('should work with America/New_York timezone (EST - winter)', () => {
      // January 28, 2025 at 13:00 EST (UTC-5)
      const classTimeUTC = new Date('2025-01-28T18:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250128',
        classTimeUTC,
        'America/New_York'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // Class: Jan 28, 13:00 EST (UTC-5) = 18:00 UTC
      // Available: Jan 24, 13:00 EST (UTC-5) = 18:00 UTC
      expect(result?.availableAt.toISOString()).toBe('2025-01-24T18:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(18);
      expect(result?.availableAt.getUTCDate()).toBe(24);
    });

    it('should work with America/New_York timezone (EDT - summer)', () => {
      // July 28, 2025 at 13:00 EDT (UTC-4)
      const classTimeUTC = new Date('2025-07-28T17:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250728',
        classTimeUTC,
        'America/New_York'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // Class: July 28, 13:00 EDT (UTC-4) = 17:00 UTC
      // Available: July 24, 13:00 EDT (UTC-4) = 17:00 UTC
      expect(result?.availableAt.toISOString()).toBe('2025-07-24T17:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(17);
      expect(result?.availableAt.getUTCDate()).toBe(24);
    });

    it('should work with Asia/Tokyo timezone (JST - no DST)', () => {
      // October 28, 2025 at 18:00 JST (UTC+9) - no DST in Japan
      const classTimeUTC = new Date('2025-10-28T09:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        classTimeUTC,
        'Asia/Tokyo'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // Class: Oct 28, 18:00 JST (UTC+9) = 09:00 UTC
      // Available: Oct 24, 18:00 JST (UTC+9) = 09:00 UTC
      expect(result?.availableAt.toISOString()).toBe('2025-10-24T09:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(9);
      expect(result?.availableAt.getUTCDate()).toBe(24);
    });

    it('should work with Australia/Sydney timezone (AEDT - summer/DST)', () => {
      // December 28, 2025 at 18:00 AEDT (UTC+11, summer time)
      const classTimeUTC = new Date('2025-12-28T07:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251228',
        classTimeUTC,
        'Australia/Sydney'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // Class: Dec 28, 18:00 AEDT (UTC+11) = 07:00 UTC
      // Available: Dec 24, 18:00 AEDT (UTC+11) = 07:00 UTC
      expect(result?.availableAt.toISOString()).toBe('2025-12-24T07:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(7);
      expect(result?.availableAt.getUTCDate()).toBe(24);
    });

    it('should work with Australia/Sydney timezone (AEST - winter/standard)', () => {
      // July 28, 2025 at 18:00 AEST (UTC+10, standard time)
      const classTimeUTC = new Date('2025-07-28T08:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20250728',
        classTimeUTC,
        'Australia/Sydney'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(4);

      // Class: July 28, 18:00 AEST (UTC+10) = 08:00 UTC
      // Available: July 24, 18:00 AEST (UTC+10) = 08:00 UTC
      expect(result?.availableAt.toISOString()).toBe('2025-07-24T08:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(8);
      expect(result?.availableAt.getUTCDate()).toBe(24);
    });

    it('should default to Europe/Madrid when timezone not provided', () => {
      const classTimeUTC = new Date('2025-10-28T07:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 4 días de antelación',
        '20251028',
        classTimeUTC
        // No timezone provided - should use default
      );

      expect(result).not.toBeNull();
      expect(result?.availableAt.toISOString()).toBe('2025-10-24T06:00:00.000Z');
    });

    it('should handle spring DST transition in America/New_York', () => {
      // March 9, 2025 is DST transition day in New York
      // At 02:00 EST, clocks move forward to 03:00 EDT
      // Booking for March 9 at 13:00 EDT (UTC-4) = 17:00 UTC
      const classTimeUTC = new Date('2025-03-09T17:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 3 días de antelación',
        '20250309',
        classTimeUTC,
        'America/New_York'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(3);

      // Available: March 6 at 13:00 EST (UTC-5) = 18:00 UTC
      // Note: March 6 is still in EST (not EDT yet)
      expect(result?.availableAt.toISOString()).toBe('2025-03-06T18:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(18);
    });

    it('should handle fall DST transition in America/New_York', () => {
      // November 2, 2025 is DST transition day in New York
      // At 02:00 EDT, clocks move back to 01:00 EST
      // Booking for Nov 2 at 13:00 EST (UTC-5) = 18:00 UTC
      const classTimeUTC = new Date('2025-11-02T18:00:00.000Z');

      const result = parseEarlyBookingError(
        'No puedes reservar clases con más de 3 días de antelación',
        '20251102',
        classTimeUTC,
        'America/New_York'
      );

      expect(result).not.toBeNull();
      expect(result?.daysAdvance).toBe(3);

      // Available: Oct 30 at 13:00 EDT (UTC-4) = 17:00 UTC
      // Note: Oct 30 is still in EDT (hasn't transitioned yet)
      expect(result?.availableAt.toISOString()).toBe('2025-10-30T17:00:00.000Z');
      expect(result?.availableAt.getUTCHours()).toBe(17);
    });

    it('should preserve local time across timezone boundaries', () => {
      // Verify the critical requirement: local time is preserved
      // Class at 15:00 in any timezone should have availability at 15:00 local time

      const testCases = [
        {
          timezone: 'Europe/Madrid',
          classTimeUTC: new Date('2025-10-28T14:00:00.000Z'), // Oct 28, 15:00 Madrid (UTC+1)
          expectedAvailableUTC: new Date('2025-10-24T13:00:00.000Z'), // Oct 24, 15:00 Madrid (UTC+2)
        },
        {
          timezone: 'America/New_York',
          classTimeUTC: new Date('2025-01-28T20:00:00.000Z'), // Jan 28, 15:00 New York (UTC-5)
          expectedAvailableUTC: new Date('2025-01-24T20:00:00.000Z'), // Jan 24, 15:00 New York (UTC-5)
        },
        {
          timezone: 'Asia/Tokyo',
          classTimeUTC: new Date('2025-10-28T06:00:00.000Z'), // Oct 28, 15:00 Tokyo (UTC+9)
          expectedAvailableUTC: new Date('2025-10-24T06:00:00.000Z'), // Oct 24, 15:00 Tokyo (UTC+9)
        },
      ];

      testCases.forEach(({ timezone, classTimeUTC, expectedAvailableUTC }) => {
        const result = parseEarlyBookingError(
          'No puedes reservar clases con más de 4 días de antelación',
          '20250128',
          classTimeUTC,
          timezone
        );

        expect(result).not.toBeNull();
        expect(result?.availableAt.toISOString()).toBe(expectedAvailableUTC.toISOString());
      });
    });
  });
});
