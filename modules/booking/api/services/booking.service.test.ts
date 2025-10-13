import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingService, BookingApiError } from './booking.service';
import { CookieService } from '@/modules/auth/api/services/cookie.service';
import { BOOKING_CONSTANTS } from '@/modules/booking/constants/booking.constants';
import {
  mockBookingApiResponse,
  mockBookingCreateRequest,
  mockBookingCreateResponse,
  mockBookingCancelRequest,
  mockBookingCancelResponse,
} from '@/tests/fixtures/booking.fixtures';
import { mockAuthCookies } from '@/tests/fixtures/auth.fixtures';

vi.mock('@/modules/auth/api/services/cookie.service');

describe('BookingService', () => {
  let bookingService: BookingService;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    bookingService = new BookingService();

    // Mock CookieService
    vi.mocked(CookieService.formatForRequest).mockReturnValue(
      'AWSALB=test; PHPSESSID=test'
    );

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key) => {
        if (key === 'user-email') return 'test@example.com';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBookings', () => {
    it('should fetch bookings successfully', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingApiResponse,
      } as Response);

      const params = { day: '2025-01-15', familyId: 'family-123' };
      const result = await bookingService.getBookings(params, mockAuthCookies);

      expect(result).toEqual(mockBookingApiResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(BOOKING_CONSTANTS.API.ENDPOINTS.BOOKINGS),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: expect.any(String),
            'x-user-email': 'test@example.com',
          }),
        })
      );
    });

    it('should build URL with query parameters', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingApiResponse,
      } as Response);

      const params = {
        day: '2025-01-15',
        familyId: 'family-123',
        boxId: 'box-456',
      };

      await bookingService.getBookings(params);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('day=2025-01-15');
      expect(calledUrl).toContain('familyId=family-123');
      expect(calledUrl).toContain('boxId=box-456');
    });

    it('should include cookies in headers when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingApiResponse,
      } as Response);

      await bookingService.getBookings({ day: '2025-01-15' }, mockAuthCookies);

      expect(CookieService.formatForRequest).toHaveBeenCalledWith(mockAuthCookies);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: expect.any(String),
          }),
        })
      );
    });

    it('should include user email from localStorage', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingApiResponse,
      } as Response);

      await bookingService.getBookings({ day: '2025-01-15' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-user-email': 'test@example.com',
          }),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(
        bookingService.getBookings({ day: '2025-01-15' })
      ).rejects.toThrow(BookingApiError);

      try {
        await bookingService.getBookings({ day: '2025-01-15' });
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect((error as BookingApiError).statusCode).toBe(404);
        expect((error as BookingApiError).type).toBe('HTTP_ERROR');
      }
    });

    it('should handle validation errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);

      await expect(
        bookingService.getBookings({ day: '2025-01-15' })
      ).rejects.toThrow(BookingApiError);

      try {
        await bookingService.getBookings({ day: '2025-01-15' });
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect((error as BookingApiError).type).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle timeout errors', async () => {
      const bookingServiceWithShortTimeout = new BookingService({ timeout: 100 });

      fetchSpy.mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Simulate abort signal triggering
            options?.signal?.addEventListener('abort', () => {
              const abortError = new DOMException('The operation was aborted', 'AbortError');
              reject(abortError);
            });
          })
      );

      try {
        await bookingServiceWithShortTimeout.getBookings({ day: '2025-01-15' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect((error as BookingApiError).type).toBe('TIMEOUT_ERROR');
        expect((error as BookingApiError).statusCode).toBe(408);
      }
    });

    it('should handle network errors', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Network error'));

      await expect(
        bookingService.getBookings({ day: '2025-01-15' })
      ).rejects.toThrow(BookingApiError);

      try {
        await bookingService.getBookings({ day: '2025-01-15' });
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect((error as BookingApiError).type).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCreateResponse,
      } as Response);

      const result = await bookingService.createBooking(
        mockBookingCreateRequest,
        mockAuthCookies
      );

      expect(result).toEqual(mockBookingCreateResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(BOOKING_CONSTANTS.API.ENDPOINTS.CREATE_BOOKING),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should format request body as URLSearchParams', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCreateResponse,
      } as Response);

      await bookingService.createBooking(mockBookingCreateRequest, mockAuthCookies);

      const fetchCall = fetchSpy.mock.calls[0];
      const body = fetchCall[1]?.body as URLSearchParams;

      expect(body.get('day')).toBe(mockBookingCreateRequest.day);
      expect(body.get('familyId')).toBe(mockBookingCreateRequest.familyId);
      expect(body.get('id')).toBe(mockBookingCreateRequest.id);
      expect(body.get('insist')).toBe(mockBookingCreateRequest.insist.toString());
    });

    it('should use custom box subdomain when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCreateResponse,
      } as Response);

      await bookingService.createBooking(
        mockBookingCreateRequest,
        mockAuthCookies,
        'custombox'
      );

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://custombox.aimharder.com');
    });

    it('should include proper headers for booking creation', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCreateResponse,
      } as Response);

      await bookingService.createBooking(mockBookingCreateRequest, mockAuthCookies);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': expect.stringContaining('Mozilla'),
            Cookie: expect.any(String),
          }),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(
        bookingService.createBooking(mockBookingCreateRequest)
      ).rejects.toThrow(BookingApiError);
    });

    it('should handle timeout errors', async () => {
      const bookingServiceWithShortTimeout = new BookingService({ timeout: 100 });

      fetchSpy.mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Simulate abort signal triggering
            options?.signal?.addEventListener('abort', () => {
              const abortError = new DOMException('The operation was aborted', 'AbortError');
              reject(abortError);
            });
          })
      );

      try {
        await bookingServiceWithShortTimeout.createBooking(mockBookingCreateRequest);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect((error as BookingApiError).type).toBe('TIMEOUT_ERROR');
      }
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCancelResponse,
      } as Response);

      const result = await bookingService.cancelBooking(
        mockBookingCancelRequest,
        mockAuthCookies
      );

      expect(result).toEqual(mockBookingCancelResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(BOOKING_CONSTANTS.API.ENDPOINTS.CANCEL_BOOKING),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should format cancel request body correctly', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCancelResponse,
      } as Response);

      await bookingService.cancelBooking(mockBookingCancelRequest, mockAuthCookies);

      const fetchCall = fetchSpy.mock.calls[0];
      const body = fetchCall[1]?.body as URLSearchParams;

      expect(body.get('id')).toBe(mockBookingCancelRequest.id);
      expect(body.get('late')).toBe(mockBookingCancelRequest.late.toString());
      expect(body.get('familyId')).toBe(mockBookingCancelRequest.familyId);
    });

    it('should use custom box subdomain when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockBookingCancelResponse,
      } as Response);

      await bookingService.cancelBooking(
        mockBookingCancelRequest,
        mockAuthCookies,
        'custombox'
      );

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://custombox.aimharder.com');
    });

    it('should handle HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(
        bookingService.cancelBooking(mockBookingCancelRequest)
      ).rejects.toThrow(BookingApiError);
    });
  });

  describe('BookingApiError', () => {
    it('should identify retryable errors', () => {
      const timeoutError = new BookingApiError('Timeout', 408, 'TIMEOUT_ERROR');
      const networkError = new BookingApiError('Network', 0, 'NETWORK_ERROR');
      const serverError = new BookingApiError('Server', 500, 'HTTP_ERROR');
      const clientError = new BookingApiError('Bad Request', 400, 'HTTP_ERROR');

      expect(timeoutError.isRetryable).toBe(true);
      expect(networkError.isRetryable).toBe(true);
      expect(serverError.isRetryable).toBe(true);
      expect(clientError.isRetryable).toBe(false);
    });

    it('should identify authentication errors', () => {
      const unauthorizedError = new BookingApiError('Unauthorized', 401, 'HTTP_ERROR');
      const forbiddenError = new BookingApiError('Forbidden', 403, 'HTTP_ERROR');
      const notFoundError = new BookingApiError('Not Found', 404, 'HTTP_ERROR');

      expect(unauthorizedError.isAuthenticationError).toBe(true);
      expect(forbiddenError.isAuthenticationError).toBe(true);
      expect(notFoundError.isAuthenticationError).toBe(false);
    });

    it('should include error details', () => {
      const validationDetails = [
        { field: 'day', message: 'Required' },
      ];
      const error = new BookingApiError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        validationDetails
      );

      expect(error.details).toEqual(validationDetails);
      expect(error.message).toBe('Validation failed');
      expect(error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('Configuration', () => {
    it('should use custom baseUrl when provided', () => {
      const customService = new BookingService({
        baseUrl: 'https://custom.example.com',
      });

      expect((customService as any).baseUrl).toBe('https://custom.example.com');
    });

    it('should use default timeout of 8000ms', () => {
      expect((bookingService as any).timeout).toBe(8000);
    });

    it('should use custom timeout when provided', () => {
      const customService = new BookingService({ timeout: 5000 });

      expect((customService as any).timeout).toBe(5000);
    });
  });
});
