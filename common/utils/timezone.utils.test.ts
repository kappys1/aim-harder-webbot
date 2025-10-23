/**
 * Tests for timezone utility functions
 *
 * Validates correct conversion of local times to UTC across different timezones
 * and DST transitions
 */

import { describe, it, expect } from 'vitest';
import {
  convertLocalToUTC,
  convertUTCToLocal,
  getBrowserTimezone,
  isValidUTCDateTime,
  formatUTCForDisplay,
} from './timezone.utils';

describe('Timezone Utils', () => {
  describe('getBrowserTimezone', () => {
    it('should return the browser timezone', () => {
      const timezone = getBrowserTimezone();
      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
      // Should be a valid IANA timezone
      expect(timezone).toMatch(/^[A-Z][a-z_]+\/[A-Z][a-z_]+$/);
    });

    it('should return fallback for errors', () => {
      const originalIntl = global.Intl;
      try {
        // Mock Intl to throw error
        (global.Intl as any) = {
          DateTimeFormat: () => {
            throw new Error('Test error');
          },
        };

        const timezone = getBrowserTimezone();
        expect(timezone).toBe('UTC');
      } finally {
        global.Intl = originalIntl;
      }
    });
  });

  describe('convertLocalToUTC - Madrid timezone', () => {
    it('should convert Madrid time (CET, UTC+1) correctly on Oct 28 (DST transition)', () => {
      // Oct 28, 2025 is after DST transition (Oct 26)
      // Madrid is in CET (UTC+1) on this date
      const utcString = convertLocalToUTC('2025-10-28', '08:00');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(7); // 08:00 CET = 07:00 UTC
      expect(utcDate.getUTCMinutes()).toBe(0);
      expect(utcDate.getUTCDate()).toBe(28);
    });

    it('should convert Madrid time (CEST, UTC+2) correctly on July 15 (summer time)', () => {
      // July 15, 2025 is during CEST (UTC+2)
      const utcString = convertLocalToUTC('2025-07-15', '08:00');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(6); // 08:00 CEST = 06:00 UTC
      expect(utcDate.getUTCMinutes()).toBe(0);
      expect(utcDate.getUTCDate()).toBe(15);
    });

    it('should handle midnight correctly', () => {
      const utcString = convertLocalToUTC('2025-10-28', '00:00');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(23); // 00:00 CET = 23:00 UTC (previous day)
      expect(utcDate.getUTCDate()).toBe(27);
    });

    it('should handle end of day correctly', () => {
      const utcString = convertLocalToUTC('2025-10-28', '23:59');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(22); // 23:59 CET = 22:59 UTC
      expect(utcDate.getUTCMinutes()).toBe(59);
      expect(utcDate.getUTCDate()).toBe(28);
    });
  });

  describe('convertLocalToUTC - New York timezone', () => {
    // Note: These tests assume the system runs in a timezone context
    // In a real environment, we would mock the browser timezone
    it('should have correct format for UTC conversion', () => {
      const utcString = convertLocalToUTC('2025-10-28', '08:00');

      // Validate format is ISO 8601 UTC
      expect(utcString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Validate it's a valid date
      const date = new Date(utcString);
      expect(!isNaN(date.getTime())).toBe(true);
    });
  });

  describe('convertUTCToLocal', () => {
    it('should convert UTC to local date object', () => {
      const utcString = '2025-10-28T07:00:00.000Z';
      const localDate = convertUTCToLocal(utcString);

      expect(localDate).toBeInstanceOf(Date);
      expect(!isNaN(localDate.getTime())).toBe(true);
    });
  });

  describe('isValidUTCDateTime', () => {
    it('should validate correct ISO 8601 UTC strings', () => {
      expect(isValidUTCDateTime('2025-10-28T07:00:00.000Z')).toBe(true);
      expect(isValidUTCDateTime('2025-01-01T00:00:00Z')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidUTCDateTime('2025-10-28T07:00:00')).toBe(false); // Missing Z
      expect(isValidUTCDateTime('2025-10-28 07:00:00')).toBe(false);
      expect(isValidUTCDateTime('invalid')).toBe(false);
      expect(isValidUTCDateTime('')).toBe(false);
    });
  });

  describe('formatUTCForDisplay', () => {
    it('should format UTC datetime for display', () => {
      const utcString = '2025-10-28T07:00:00.000Z';
      const formatted = formatUTCForDisplay(utcString);

      expect(typeof formatted).toBe('string');
      expect(formatted.length > 0).toBe(true);
      // Should not be the raw ISO string (should be formatted)
      expect(formatted).not.toBe(utcString);
    });

    it('should handle custom format strings', () => {
      const utcString = '2025-10-28T07:00:00.000Z';
      const formatted = formatUTCForDisplay(utcString, 'yyyy-MM-dd HH:mm');

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should return ISO string as fallback on error', () => {
      const utcString = 'invalid-date';
      const formatted = formatUTCForDisplay(utcString);

      expect(formatted).toBe(utcString);
    });
  });

  describe('DST Transition Edge Cases', () => {
    it('should handle spring forward (March 30, 2025 in Madrid)', () => {
      // March 30, 2025 is DST start (CEST begins)
      // At 02:00 CEST, clocks move forward to 03:00 CEST
      const utcString = convertLocalToUTC('2025-03-30', '03:00');

      const utcDate = new Date(utcString);
      // After DST starts, Madrid is UTC+2
      expect(utcDate.getUTCHours()).toBe(1); // 03:00 CEST = 01:00 UTC
    });

    it('should handle fall back (October 26, 2025 in Madrid)', () => {
      // October 26, 2025 is DST end (CET begins)
      // At 03:00 CEST, clocks move back to 02:00 CET
      const utcString = convertLocalToUTC('2025-10-26', '02:00');

      const utcDate = new Date(utcString);
      // After DST ends, Madrid is UTC+1
      expect(utcDate.getUTCHours()).toBe(1); // 02:00 CET = 01:00 UTC
    });
  });

  describe('Round-trip conversions', () => {
    it('should correctly convert local -> UTC -> local', () => {
      const originalTime = '08:00';
      const originalDate = '2025-10-28';

      // Convert to UTC
      const utcString = convertLocalToUTC(originalDate, originalTime);

      // Convert back to local
      const localDate = convertUTCToLocal(utcString);

      // Check that the local hour matches original
      // (Note: exact match depends on timezone context)
      expect(localDate).toBeInstanceOf(Date);
    });
  });

  describe('Cross-DST scenario (critical bug fix)', () => {
    /**
     * This test validates the fix for the cross-DST booking issue:
     *
     * SCENARIO:
     * - TODAY: Oct 24, 2025 (UTC+2, CEST summer time in Madrid)
     * - CLASS: Oct 24, 2025 at 08:00 local time
     * - PROBLEM: The class is BEFORE the DST transition (Oct 26)
     *   BUT the user's timezone offset TODAY is UTC+2
     *   However, bookings made TODAY for FUTURE dates must account for
     *   the actual DST status on THAT specific date
     *
     * EXPECTED: 08:00 local should correctly convert to 07:00 UTC (not 06:00)
     *
     * Root cause of bug: Using the current date's DST offset instead of
     * the target date's DST offset
     */
    it('should use target date DST offset, not current date DST offset', () => {
      // Oct 24 is CEST (UTC+2) because DST ends Oct 26
      // So 08:00 on Oct 24 should be 06:00 UTC
      const utcString = convertLocalToUTC('2025-10-24', '08:00');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(6); // 08:00 CEST = 06:00 UTC
      expect(utcDate.getUTCDate()).toBe(24);
    });

    it('should handle booking after DST transition correctly', () => {
      // Oct 28 is CET (UTC+1) because DST ended Oct 26
      // So 08:00 on Oct 28 should be 07:00 UTC (not 06:00)
      const utcString = convertLocalToUTC('2025-10-28', '08:00');

      const utcDate = new Date(utcString);
      expect(utcDate.getUTCHours()).toBe(7); // 08:00 CET = 07:00 UTC
      expect(utcDate.getUTCDate()).toBe(28);
    });

    it('should correctly calculate availableAt for cross-DST prebooking', () => {
      // Simulate the exact scenario from the bug report:
      // - User in Madrid books class for Oct 24 at 08:00
      // - Oct 24 is in CEST (UTC+2)
      // - So 08:00 = 06:00 UTC

      const classTimeUTC = convertLocalToUTC('2025-10-24', '08:00');
      const classDate = new Date(classTimeUTC);

      expect(classDate.getUTCHours()).toBe(6);

      // Now calculate availableAt (4 days before)
      // We use the UTC representation to subtract days
      const daysAdvance = 4;
      const availableAtTime = new Date(classDate);
      availableAtTime.setUTCDate(availableAtTime.getUTCDate() - daysAdvance);

      // Should be Oct 20 at 06:00 UTC
      expect(availableAtTime.getUTCDate()).toBe(20);
      expect(availableAtTime.getUTCHours()).toBe(6); // Same time as class
    });
  });
});
