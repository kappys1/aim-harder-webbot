import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingUtils } from './booking.utils';
import { BookingStatus } from '../models/booking.model';
import { mockBooking } from '@/tests/fixtures/booking.fixtures';

describe('BookingUtils', () => {
  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date('2025-01-15T10:00:00');
      const result = BookingUtils.formatDate(date);

      expect(result).toBe('15 ene 2025');
    });

    it('should format date string', () => {
      const result = BookingUtils.formatDate('2025-01-15');

      expect(result).toContain('ene');
      expect(result).toContain('2025');
    });

    it('should format with custom format string', () => {
      const date = new Date('2025-01-15T10:00:00');
      const result = BookingUtils.formatDate(date, 'dd/MM/yyyy');

      expect(result).toBe('15/01/2025');
    });

    it('should return empty string for invalid date', () => {
      const result = BookingUtils.formatDate('invalid-date');

      expect(result).toBe('');
    });
  });

  describe('formatDateForApi', () => {
    it('should format date for API', () => {
      const date = new Date('2025-01-15T10:00:00');
      const result = BookingUtils.formatDateForApi(date);

      expect(result).toBe('20250115');
    });

    it('should format date string for API', () => {
      const result = BookingUtils.formatDateForApi('2025-01-15');

      expect(result).toBe('20250115');
    });

    it('should throw error for invalid date', () => {
      expect(() => BookingUtils.formatDateForApi('invalid-date')).toThrow('Invalid date provided');
    });
  });

  describe('parseTime', () => {
    it('should parse time string correctly', () => {
      const result = BookingUtils.parseTime('14:30');

      expect(result).toEqual({ hours: 14, minutes: 30 });
    });

    it('should parse time with leading zeros', () => {
      const result = BookingUtils.parseTime('09:05');

      expect(result).toEqual({ hours: 9, minutes: 5 });
    });

    it('should handle malformed time gracefully', () => {
      const result = BookingUtils.parseTime('invalid');

      expect(result).toEqual({ hours: 0, minutes: 0 });
    });
  });

  describe('calculateCapacityPercentage', () => {
    it('should calculate percentage correctly', () => {
      const result = BookingUtils.calculateCapacityPercentage(8, 15);

      expect(result).toBe(53);
    });

    it('should return 0 when limit is 0', () => {
      const result = BookingUtils.calculateCapacityPercentage(5, 0);

      expect(result).toBe(0);
    });

    it('should return 100 when full', () => {
      const result = BookingUtils.calculateCapacityPercentage(15, 15);

      expect(result).toBe(100);
    });

    it('should round to nearest integer', () => {
      const result = BookingUtils.calculateCapacityPercentage(7, 15);

      expect(result).toBe(47);
    });
  });

  describe('getCapacityColor', () => {
    it('should return green for low capacity', () => {
      const result = BookingUtils.getCapacityColor(30);

      expect(result).toBe('#2BB143');
    });

    it('should return orange for medium capacity', () => {
      const result = BookingUtils.getCapacityColor(65);

      expect(result).toBe('#f59e0b');
    });

    it('should return red for high capacity', () => {
      const result = BookingUtils.getCapacityColor(90);

      expect(result).toBe('#6b7280');
    });

    it('should handle boundary at 50%', () => {
      expect(BookingUtils.getCapacityColor(49)).toBe('#2BB143');
      expect(BookingUtils.getCapacityColor(50)).toBe('#f59e0b');
    });

    it('should handle boundary at 80%', () => {
      expect(BookingUtils.getCapacityColor(79)).toBe('#f59e0b');
      expect(BookingUtils.getCapacityColor(80)).toBe('#6b7280');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color for each status', () => {
      expect(BookingUtils.getStatusColor(BookingStatus.AVAILABLE)).toBe('#2BB143');
      expect(BookingUtils.getStatusColor(BookingStatus.BOOKED)).toBe('#2563eb');
      expect(BookingUtils.getStatusColor(BookingStatus.FULL)).toBe('#6b7280');
      expect(BookingUtils.getStatusColor(BookingStatus.WAITLIST)).toBe('#f59e0b');
      expect(BookingUtils.getStatusColor(BookingStatus.DISABLED)).toBe('#d1d5db');
    });

    it('should return disabled color for unknown status', () => {
      const result = BookingUtils.getStatusColor('UNKNOWN' as BookingStatus);

      expect(result).toBe('#d1d5db');
    });
  });

  describe('getStatusText', () => {
    it('should return correct text for each status', () => {
      expect(BookingUtils.getStatusText(BookingStatus.AVAILABLE)).toBe('Disponible');
      expect(BookingUtils.getStatusText(BookingStatus.BOOKED)).toBe('Reservado');
      expect(BookingUtils.getStatusText(BookingStatus.FULL)).toBe('Completo');
      expect(BookingUtils.getStatusText(BookingStatus.WAITLIST)).toBe('Lista de espera');
      expect(BookingUtils.getStatusText(BookingStatus.DISABLED)).toBe('No disponible');
    });

    it('should return unknown for invalid status', () => {
      const result = BookingUtils.getStatusText('INVALID' as BookingStatus);

      expect(result).toBe('Desconocido');
    });
  });

  describe('isBookingAvailable', () => {
    it('should return true for available status', () => {
      const booking = { ...mockBooking, status: BookingStatus.AVAILABLE };

      expect(BookingUtils.isBookingAvailable(booking)).toBe(true);
    });

    it('should return true for waitlist status', () => {
      const booking = { ...mockBooking, status: BookingStatus.WAITLIST };

      expect(BookingUtils.isBookingAvailable(booking)).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(BookingUtils.isBookingAvailable({ ...mockBooking, status: BookingStatus.BOOKED })).toBe(false);
      expect(BookingUtils.isBookingAvailable({ ...mockBooking, status: BookingStatus.FULL })).toBe(false);
      expect(BookingUtils.isBookingAvailable({ ...mockBooking, status: BookingStatus.DISABLED })).toBe(false);
    });
  });

  describe('canUserBook', () => {
    it('should return true when booking is available and included in plan', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.AVAILABLE,
        isIncludedInPlan: true,
        userBookingId: null,
      };

      expect(BookingUtils.canUserBook(booking)).toBe(true);
    });

    it('should return false when user already has booking', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.AVAILABLE,
        isIncludedInPlan: true,
        userBookingId: 'booking-123',
      };

      expect(BookingUtils.canUserBook(booking)).toBe(false);
    });

    it('should return false when not included in plan', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.AVAILABLE,
        isIncludedInPlan: false,
        userBookingId: null,
      };

      expect(BookingUtils.canUserBook(booking)).toBe(false);
    });

    it('should return false when booking is not available', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.FULL,
        isIncludedInPlan: true,
        userBookingId: null,
      };

      expect(BookingUtils.canUserBook(booking)).toBe(false);
    });
  });

  describe('canUserCancel', () => {
    it('should return true for booked status', () => {
      const booking = { ...mockBooking, status: BookingStatus.BOOKED };

      expect(BookingUtils.canUserCancel(booking)).toBe(true);
    });

    it('should return true for waitlist with user booking', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.WAITLIST,
        userBookingId: 'booking-123',
      };

      expect(BookingUtils.canUserCancel(booking)).toBe(true);
    });

    it('should return false for waitlist without user booking', () => {
      const booking = {
        ...mockBooking,
        status: BookingStatus.WAITLIST,
        userBookingId: null,
      };

      expect(BookingUtils.canUserCancel(booking)).toBe(false);
    });

    it('should return false for other statuses', () => {
      expect(BookingUtils.canUserCancel({ ...mockBooking, status: BookingStatus.AVAILABLE })).toBe(false);
      expect(BookingUtils.canUserCancel({ ...mockBooking, status: BookingStatus.FULL })).toBe(false);
    });
  });

  describe('filterBookings', () => {
    const bookings = [
      { ...mockBooking, class: { ...mockBooking.class, name: 'CrossFit WOD' } },
      { ...mockBooking, class: { ...mockBooking.class, name: 'BARBELL' }, status: BookingStatus.FULL },
      {
        ...mockBooking,
        class: { ...mockBooking.class, name: 'CrossFit WOD' },
        status: BookingStatus.WAITLIST,
        timeSlot: { ...mockBooking.timeSlot, startTime: '18:00', endTime: '19:00' },
      },
    ];

    it('should filter by class types', () => {
      const result = BookingUtils.filterBookings(bookings, {
        classTypes: ['CrossFit WOD'],
      });

      expect(result).toHaveLength(2);
      expect(result.every(b => b.class.name === 'CrossFit WOD')).toBe(true);
    });

    it('should filter by availability', () => {
      const result = BookingUtils.filterBookings(bookings, {
        availabilityOnly: true,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.every(b => b.status === BookingStatus.AVAILABLE || b.status === BookingStatus.WAITLIST)).toBe(true);
    });

    it('should exclude waitlist when specified', () => {
      const result = BookingUtils.filterBookings(bookings, {
        includeWaitlist: false,
      });

      expect(result.every(b => b.status !== BookingStatus.WAITLIST)).toBe(true);
    });

    it('should filter by time range', () => {
      const result = BookingUtils.filterBookings(bookings, {
        timeRange: { start: '17:00', end: '20:00' },
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should apply multiple filters together', () => {
      const result = BookingUtils.filterBookings(bookings, {
        classTypes: ['CrossFit WOD'],
        availabilityOnly: true,
      });

      expect(result.every(b => b.class.name === 'CrossFit WOD')).toBe(true);
    });

    it('should return all bookings when no filter applied', () => {
      const result = BookingUtils.filterBookings(bookings, {});

      expect(result).toHaveLength(bookings.length);
    });
  });

  describe('sortBookingsByTime', () => {
    it('should sort bookings by start time', () => {
      const bookings = [
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, startTime: '18:00' } },
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, startTime: '09:00' } },
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, startTime: '14:00' } },
      ];

      const result = BookingUtils.sortBookingsByTime(bookings);

      expect(result[0].timeSlot.startTime).toBe('09:00');
      expect(result[1].timeSlot.startTime).toBe('14:00');
      expect(result[2].timeSlot.startTime).toBe('18:00');
    });

    it('should not mutate original array', () => {
      const bookings = [
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, startTime: '18:00' } },
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, startTime: '09:00' } },
      ];

      const original = [...bookings];
      BookingUtils.sortBookingsByTime(bookings);

      expect(bookings).toEqual(original);
    });
  });

  describe('groupBookingsByTimeSlot', () => {
    it('should group bookings by time slot ID', () => {
      const bookings = [
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, id: '1' } },
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, id: '2' } },
        { ...mockBooking, timeSlot: { ...mockBooking.timeSlot, id: '1' } },
      ];

      const result = BookingUtils.groupBookingsByTimeSlot(bookings);

      expect(result['1']).toHaveLength(2);
      expect(result['2']).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const result = BookingUtils.groupBookingsByTimeSlot([]);

      expect(result).toEqual({});
    });
  });

  describe('getAvailableClassTypes', () => {
    it('should return unique class types sorted', () => {
      const bookings = [
        { ...mockBooking, class: { ...mockBooking.class, name: 'BARBELL' } },
        { ...mockBooking, class: { ...mockBooking.class, name: 'CrossFit WOD' } },
        { ...mockBooking, class: { ...mockBooking.class, name: 'BARBELL' } },
        { ...mockBooking, class: { ...mockBooking.class, name: 'GYMNASTICS' } },
      ];

      const result = BookingUtils.getAvailableClassTypes(bookings);

      expect(result).toEqual(['BARBELL', 'CrossFit WOD', 'GYMNASTICS']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for empty bookings', () => {
      const result = BookingUtils.getAvailableClassTypes([]);

      expect(result).toEqual([]);
    });
  });

  describe('getCacheKey', () => {
    it('should generate cache key with date and boxId', () => {
      const result = BookingUtils.getCacheKey('2025-01-15', 'box-123');

      expect(result).toBe('bookings_box-123_2025-01-15');
    });

    it('should handle different formats consistently', () => {
      const key1 = BookingUtils.getCacheKey('2025-01-15', 'box-123');
      const key2 = BookingUtils.getCacheKey('2025-01-15', 'box-123');

      expect(key1).toBe(key2);
    });
  });

  describe('isToday', () => {
    it('should return true for today date', () => {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      expect(BookingUtils.isToday(dateString)).toBe(true);
    });

    it('should return false for past date', () => {
      const result = BookingUtils.isToday('2020-01-01');

      expect(result).toBe(false);
    });

    it('should return false for future date', () => {
      const result = BookingUtils.isToday('2030-01-01');

      expect(result).toBe(false);
    });
  });

  describe('isPastTimeSlot', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false for future date', () => {
      const futureDate = '2030-01-01';

      expect(BookingUtils.isPastTimeSlot('10:00', futureDate)).toBe(false);
    });

    it('should return true for past time slot on today', () => {
      const now = new Date('2025-01-15T14:00:00');
      vi.setSystemTime(now);

      const today = now.toISOString().split('T')[0];
      const result = BookingUtils.isPastTimeSlot('10:00', today);

      expect(result).toBe(true);
    });

    it('should return false for future time slot on today', () => {
      const now = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(now);

      const today = now.toISOString().split('T')[0];
      const result = BookingUtils.isPastTimeSlot('14:00', today);

      expect(result).toBe(false);
    });

    it('should return false for current time slot', () => {
      const now = new Date('2025-01-15T14:00:00');
      vi.setSystemTime(now);

      const today = now.toISOString().split('T')[0];
      const result = BookingUtils.isPastTimeSlot('14:00', today);

      expect(result).toBe(false);
    });
  });

  describe('generateCacheTimestamp', () => {
    it('should return a number', () => {
      const result = BookingUtils.generateCacheTimestamp();

      expect(typeof result).toBe('number');
    });

    it('should return current timestamp', () => {
      const before = Date.now();
      const result = BookingUtils.generateCacheTimestamp();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });
});
