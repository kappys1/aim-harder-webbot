import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingBusiness, BookingValidationResult } from './booking.business';
import { BookingService, BookingApiError } from '../api/services/booking.service';
import { BookingMapper } from '../api/mappers/booking.mapper';
import { BookingUtils } from '../utils/booking.utils';
import { BookingStatus } from '../models/booking.model';
import { mockBookingApiResponse, mockBooking, mockBookingDay } from '@/tests/fixtures/booking.fixtures';
import { mockAuthCookies } from '@/tests/fixtures/auth.fixtures';

vi.mock('../api/mappers/booking.mapper');
vi.mock('../utils/booking.utils');

describe('BookingBusiness', () => {
  let bookingBusiness: BookingBusiness;
  let mockBookingService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBookingService = {
      getBookings: vi.fn(),
    };

    bookingBusiness = new BookingBusiness(mockBookingService);

    // Mock BookingMapper
    vi.mocked(BookingMapper.mapBookingDay).mockReturnValue(mockBookingDay);

    // Mock BookingUtils default implementations
    vi.mocked(BookingUtils.formatDateForApi).mockReturnValue('20250115');
    vi.mocked(BookingUtils.getCacheKey).mockReturnValue('bookings_10122_2025-01-15');
    vi.mocked(BookingUtils.generateCacheTimestamp).mockReturnValue(1234567890);
    vi.mocked(BookingUtils.calculateCapacityPercentage).mockImplementation(
      (current, limit) => Number(((current / limit) * 100).toFixed(2))
    );
    vi.mocked(BookingUtils.isPastTimeSlot).mockReturnValue(false);
    vi.mocked(BookingUtils.filterBookings).mockImplementation(bookings => bookings);
    vi.mocked(BookingUtils.sortBookingsByTime).mockImplementation(bookings => bookings);
    vi.mocked(BookingUtils.getAvailableClassTypes).mockReturnValue(['CrossFit WOD']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBookingsForDay', () => {
    it('should fetch bookings successfully', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      const result = await bookingBusiness.getBookingsForDay('2025-01-15');

      expect(result).toEqual(mockBookingDay);
      expect(mockBookingService.getBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          day: '20250115',
          box: '10122',
        }),
        undefined
      );
      expect(BookingMapper.mapBookingDay).toHaveBeenCalledWith(mockBookingApiResponse);
    });

    it('should use provided box ID', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await bookingBusiness.getBookingsForDay('2025-01-15', 'custom-box-id');

      expect(mockBookingService.getBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          box: 'custom-box-id',
        }),
        undefined
      );
    });

    it('should pass cookies to service', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await bookingBusiness.getBookingsForDay('2025-01-15', '10122', mockAuthCookies);

      expect(mockBookingService.getBookings).toHaveBeenCalledWith(
        expect.any(Object),
        mockAuthCookies
      );
    });

    it('should cache successful responses', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      // First call
      await bookingBusiness.getBookingsForDay('2025-01-15');

      // Second call - should use cache
      const result = await bookingBusiness.getBookingsForDay('2025-01-15');

      expect(result).toEqual(mockBookingDay);
      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(1);
    });

    it('should not cache when cache is disabled', async () => {
      const businessWithoutCache = new BookingBusiness(mockBookingService, { cacheEnabled: false });
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await businessWithoutCache.getBookingsForDay('2025-01-15');
      await businessWithoutCache.getBookingsForDay('2025-01-15');

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(2);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = new BookingApiError('Timeout', 408, 'TIMEOUT_ERROR');

      mockBookingService.getBookings
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue(mockBookingApiResponse);

      const result = await bookingBusiness.getBookingsForDay('2025-01-15');

      expect(result).toEqual(mockBookingDay);
      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new BookingApiError('Bad Request', 400, 'HTTP_ERROR');
      mockBookingService.getBookings.mockRejectedValue(nonRetryableError);

      await expect(
        bookingBusiness.getBookingsForDay('2025-01-15')
      ).rejects.toThrow(BookingApiError);

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retry attempts', async () => {
      const businessWithFewRetries = new BookingBusiness(mockBookingService, {
        retryAttempts: 2,
        retryDelay: 10
      });
      const retryableError = new BookingApiError('Timeout', 408, 'TIMEOUT_ERROR');
      mockBookingService.getBookings.mockRejectedValue(retryableError);

      await expect(
        businessWithFewRetries.getBookingsForDay('2025-01-15')
      ).rejects.toThrow(BookingApiError);

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(2);
    });

    it('should enhance bookings with past time slot detection', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);
      vi.mocked(BookingUtils.isPastTimeSlot).mockReturnValue(true);

      await bookingBusiness.getBookingsForDay('2025-01-15');

      expect(BookingUtils.isPastTimeSlot).toHaveBeenCalled();
    });
  });

  describe('validateBookingEligibility', () => {
    it('should validate available booking as eligible', () => {
      const result = bookingBusiness.validateBookingEligibility(mockBooking);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject disabled bookings', () => {
      const disabledBooking = {
        ...mockBooking,
        status: BookingStatus.DISABLED
      };

      const result = bookingBusiness.validateBookingEligibility(disabledBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Esta clase no está disponible');
    });

    it('should reject full bookings without waitlist', () => {
      const fullBooking = {
        ...mockBooking,
        status: BookingStatus.FULL,
        capacity: {
          ...mockBooking.capacity,
          hasWaitlist: false,
        },
      };

      const result = bookingBusiness.validateBookingEligibility(fullBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Esta clase está completa');
    });

    it('should reject bookings where user already has a reservation', () => {
      const bookedBooking = {
        ...mockBooking,
        userBookingId: 'user-booking-123',
      };

      const result = bookingBusiness.validateBookingEligibility(bookedBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Ya tienes una reserva para esta clase');
    });

    it('should warn about bookings not included in plan', () => {
      const notIncludedBooking = {
        ...mockBooking,
        isIncludedInPlan: false,
      };

      const result = bookingBusiness.validateBookingEligibility(notIncludedBooking);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Esta clase no está incluida en tu plan actual');
    });

    it('should reject past time slots', () => {
      vi.mocked(BookingUtils.isPastTimeSlot).mockReturnValue(true);

      const result = bookingBusiness.validateBookingEligibility(mockBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No puedes reservar clases que ya han comenzado');
    });

    it('should warn about nearly full bookings', () => {
      const nearlyFullBooking = {
        ...mockBooking,
        capacity: {
          ...mockBooking.capacity,
          percentage: 95,
        },
      };

      const result = bookingBusiness.validateBookingEligibility(nearlyFullBooking);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Esta clase está casi completa');
    });

    it('should accumulate multiple errors', () => {
      const invalidBooking = {
        ...mockBooking,
        status: BookingStatus.DISABLED,
        userBookingId: 'user-booking-123',
      };

      const result = bookingBusiness.validateBookingEligibility(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('filterAndSortBookings', () => {
    const mockBookings = [mockBooking];

    it('should return all bookings without filter', () => {
      const result = bookingBusiness.filterAndSortBookings(mockBookings);

      expect(result).toEqual(mockBookings);
      expect(BookingUtils.sortBookingsByTime).toHaveBeenCalledWith(mockBookings);
    });

    it('should apply filter when provided', () => {
      const filter = { availabilityOnly: true };

      bookingBusiness.filterAndSortBookings(mockBookings, filter);

      expect(BookingUtils.filterBookings).toHaveBeenCalledWith(mockBookings, filter);
    });

    it('should skip sorting when sortByTime is false', () => {
      const result = bookingBusiness.filterAndSortBookings(mockBookings, undefined, false);

      expect(BookingUtils.sortBookingsByTime).not.toHaveBeenCalled();
      expect(result).toEqual(mockBookings);
    });

    it('should filter and sort together', () => {
      const filter = { classTypes: ['CrossFit WOD'] };
      vi.mocked(BookingUtils.filterBookings).mockReturnValue(mockBookings);
      vi.mocked(BookingUtils.sortBookingsByTime).mockReturnValue(mockBookings);

      const result = bookingBusiness.filterAndSortBookings(mockBookings, filter, true);

      expect(BookingUtils.filterBookings).toHaveBeenCalledWith(mockBookings, filter);
      expect(BookingUtils.sortBookingsByTime).toHaveBeenCalled();
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getBookingStatistics', () => {
    it('should calculate correct statistics', () => {
      const bookings = [
        { ...mockBooking, status: BookingStatus.AVAILABLE },
        { ...mockBooking, status: BookingStatus.BOOKED },
        { ...mockBooking, status: BookingStatus.FULL },
        { ...mockBooking, status: BookingStatus.WAITLIST },
      ];

      const stats = bookingBusiness.getBookingStatistics(bookings);

      expect(stats.total).toBe(4);
      expect(stats.available).toBe(1);
      expect(stats.booked).toBe(1);
      expect(stats.full).toBe(1);
      expect(stats.waitlist).toBe(1);
      expect(stats.availabilityPercentage).toBe(25);
    });

    it('should calculate capacity correctly', () => {
      const bookings = [
        {
          ...mockBooking,
          capacity: { ...mockBooking.capacity, current: 10, limit: 20 }
        },
        {
          ...mockBooking,
          capacity: { ...mockBooking.capacity, current: 5, limit: 10 }
        },
      ];

      const stats = bookingBusiness.getBookingStatistics(bookings);

      expect(stats.totalCapacity).toBe(30);
      expect(stats.totalOccupied).toBe(15);
      expect(stats.occupancyPercentage).toBe(50);
    });

    it('should handle empty bookings array', () => {
      const stats = bookingBusiness.getBookingStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.available).toBe(0);
      expect(stats.availabilityPercentage).toBe(0);
      expect(stats.occupancyPercentage).toBe(0);
    });

    it('should include class types', () => {
      vi.mocked(BookingUtils.getAvailableClassTypes).mockReturnValue(['WOD', 'BARBELL']);

      const stats = bookingBusiness.getBookingStatistics([mockBooking]);

      expect(stats.classTypes).toEqual(['WOD', 'BARBELL']);
      expect(BookingUtils.getAvailableClassTypes).toHaveBeenCalledWith([mockBooking]);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await bookingBusiness.getBookingsForDay('2025-01-15');
      bookingBusiness.clearCache();
      await bookingBusiness.getBookingsForDay('2025-01-15');

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(2);
    });

    it('should return cache statistics', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await bookingBusiness.getBookingsForDay('2025-01-15');

      const stats = bookingBusiness.getCacheStats();

      expect(stats.total).toBe(1);
      expect(stats.valid).toBe(1);
      expect(stats.expired).toBe(0);
      expect(stats.cacheEnabled).toBe(true);
    });

    it('should detect expired cache entries', async () => {
      const businessWithShortCache = new BookingBusiness(mockBookingService, {
        cacheTimeout: 100
      });
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await businessWithShortCache.getBookingsForDay('2025-01-15');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = businessWithShortCache.getCacheStats();

      expect(stats.expired).toBe(1);
      expect(stats.valid).toBe(0);
    });

    it('should not use expired cache', async () => {
      const businessWithShortCache = new BookingBusiness(mockBookingService, {
        cacheTimeout: 100
      });
      mockBookingService.getBookings.mockResolvedValue(mockBookingApiResponse);

      await businessWithShortCache.getBookingsForDay('2025-01-15');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      await businessWithShortCache.getBookingsForDay('2025-01-15');

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const business = new BookingBusiness(mockBookingService);
      const stats = business.getCacheStats();

      expect(stats.cacheEnabled).toBe(true);
    });

    it('should respect custom retry configuration', async () => {
      const customBusiness = new BookingBusiness(mockBookingService, {
        retryAttempts: 5,
        retryDelay: 50,
      });

      const retryableError = new BookingApiError('Timeout', 408, 'TIMEOUT_ERROR');
      mockBookingService.getBookings.mockRejectedValue(retryableError);

      await expect(
        customBusiness.getBookingsForDay('2025-01-15')
      ).rejects.toThrow(BookingApiError);

      expect(mockBookingService.getBookings).toHaveBeenCalledTimes(5);
    });
  });
});
