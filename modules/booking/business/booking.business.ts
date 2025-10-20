import { BookingService, BookingApiError } from '../api/services/booking.service';
import { BookingMapper } from '../api/mappers/booking.mapper';
import { BookingRequestParams, BookingCreateRequest } from '../api/models/booking.api';
import { BookingDay, Booking, BookingStatus, BookingFilter } from '../models/booking.model';
import { BookingUtils } from '../utils/booking.utils';
import { BOOKING_CONSTANTS } from '../constants/booking.constants';
import { AuthCookie } from '../../auth/api/services/cookie.service';

export interface BookingBusinessConfig {
  cacheEnabled?: boolean;
  cacheTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class BookingBusiness {
  private bookingService: BookingService;
  private cache: Map<string, { data: BookingDay; timestamp: number }>;
  private config: Required<BookingBusinessConfig>;

  constructor(
    bookingService: BookingService = new BookingService(),
    config: BookingBusinessConfig = {}
  ) {
    this.bookingService = bookingService;
    this.cache = new Map();
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTimeout: config.cacheTimeout ?? BOOKING_CONSTANTS.CACHE.STALE_TIME,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  async getBookingsForDay(
    date: string,
    boxId: string, // UUID of the box (required - no default)
    cookies?: AuthCookie[]
  ): Promise<BookingDay> {
    if (!boxId) {
      throw new Error('boxId is required to fetch bookings');
    }

    const cacheKey = BookingUtils.getCacheKey(date, boxId);

    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const apiDate = BookingUtils.formatDateForApi(date);
    const params: BookingRequestParams = {
      day: apiDate,
      boxId: boxId, // Pass UUID instead of Aimharder ID
      _: BookingUtils.generateCacheTimestamp(),
    };

    let lastError: BookingApiError | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await this.bookingService.getBookings(params, cookies);
        const bookingDay = BookingMapper.mapBookingDay(response);

        const enhancedBookingDay = this.enhanceBookingDay(bookingDay, date);

        if (this.config.cacheEnabled) {
          this.setCachedData(cacheKey, enhancedBookingDay);
        }

        return enhancedBookingDay;

      } catch (error) {
        if (error instanceof BookingApiError) {
          lastError = error;

          if (!error.isRetryable || attempt === this.config.retryAttempts) {
            throw error;
          }

          await this.delay(this.config.retryDelay * attempt);
        } else {
          throw error;
        }
      }
    }

    throw lastError || new BookingApiError('Unknown error during booking fetch', 500, 'UNKNOWN_ERROR');
  }

  validateBookingEligibility(booking: Booking, userContext?: any): BookingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (booking.status === BookingStatus.DISABLED) {
      errors.push('Esta clase no está disponible');
    }

    if (booking.status === BookingStatus.FULL && !booking.capacity.hasWaitlist) {
      errors.push('Esta clase está completa');
    }

    if (booking.userBookingId) {
      errors.push('Ya tienes una reserva para esta clase');
    }

    if (!booking.isIncludedInPlan) {
      warnings.push('Esta clase no está incluida en tu plan actual');
    }

    if (BookingUtils.isPastTimeSlot(booking.timeSlot.startTime, booking.timeSlot.time)) {
      errors.push('No puedes reservar clases que ya han comenzado');
    }

    if (booking.capacity.percentage > 90) {
      warnings.push('Esta clase está casi completa');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  filterAndSortBookings(
    bookings: Booking[],
    filter?: BookingFilter,
    sortByTime: boolean = true
  ): Booking[] {
    let filtered = bookings;

    if (filter) {
      filtered = BookingUtils.filterBookings(bookings, filter);
    }

    if (sortByTime) {
      filtered = BookingUtils.sortBookingsByTime(filtered);
    }

    return filtered;
  }

  getBookingStatistics(bookings: Booking[]) {
    const total = bookings.length;
    const available = bookings.filter(b => b.status === BookingStatus.AVAILABLE).length;
    const booked = bookings.filter(b => b.status === BookingStatus.BOOKED).length;
    const full = bookings.filter(b => b.status === BookingStatus.FULL).length;
    const waitlist = bookings.filter(b => b.status === BookingStatus.WAITLIST).length;

    const totalCapacity = bookings.reduce((sum, b) => sum + b.capacity.limit, 0);
    const totalOccupied = bookings.reduce((sum, b) => sum + b.capacity.current, 0);

    return {
      total,
      available,
      booked,
      full,
      waitlist,
      totalCapacity,
      totalOccupied,
      availabilityPercentage: total > 0 ? Math.round((available / total) * 100) : 0,
      occupancyPercentage: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
      classTypes: BookingUtils.getAvailableClassTypes(bookings),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    const valid = entries.filter(entry => now - entry.timestamp < this.config.cacheTimeout).length;
    const expired = entries.length - valid;

    return {
      total: entries.length,
      valid,
      expired,
      cacheEnabled: this.config.cacheEnabled,
    };
  }

  private enhanceBookingDay(bookingDay: BookingDay, requestedDate: string): BookingDay {
    const enhancedBookings = bookingDay.bookings.map(booking => {
      const enhanced = { ...booking };

      if (BookingUtils.isPastTimeSlot(booking.timeSlot.startTime, requestedDate)) {
        enhanced.status = BookingStatus.DISABLED;
      }

      enhanced.capacity = {
        ...enhanced.capacity,
        percentage: BookingUtils.calculateCapacityPercentage(
          enhanced.capacity.current,
          enhanced.capacity.limit
        ),
      };

      return enhanced;
    });

    return {
      ...bookingDay,
      bookings: enhancedBookings,
    };
  }

  private getCachedData(key: string): BookingDay | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: BookingDay): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    this.cleanupExpiredCache();
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const bookingBusiness = new BookingBusiness();