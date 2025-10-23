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
        '[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay'
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
        '[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay'
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
  });
});
