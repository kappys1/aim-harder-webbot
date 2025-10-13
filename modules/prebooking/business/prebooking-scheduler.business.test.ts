import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreBookingScheduler } from './prebooking-scheduler.business';
import { preBookingService } from '../api/services/prebooking.service';
import { bookingService } from '@/modules/booking/api/services/booking.service';
import { SupabaseSessionService } from '@/modules/auth/api/services/supabase-session.service';
import { PreBooking } from '../models/prebooking.model';
import { BookingCreateRequest } from '@/modules/booking/api/models/booking.api';

// Mock dependencies
vi.mock('../api/services/prebooking.service');
vi.mock('@/modules/booking/api/services/booking.service');
vi.mock('@/modules/auth/api/services/supabase-session.service');

describe('PreBookingScheduler', () => {
  let scheduler: PreBookingScheduler;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  const mockPreBooking: PreBooking = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userEmail: 'test@example.com',
    bookingData: {
      day: '20250115',
      familyId: 'family-123',
      id: 'class-1',
      insist: 0,
    } as BookingCreateRequest,
    availableAt: new Date('2025-01-15T08:00:00.000Z'),
    status: 'pending',
    boxId: '223e4567-e89b-12d3-a456-426614174000',
    createdAt: new Date('2025-01-14T10:00:00.000Z'),
  };

  const mockSession = {
    user: { email: 'test@example.com' },
    cookies: [
      { name: 'AWSALB', value: 'test-value' },
      { name: 'PHPSESSID', value: 'test-session' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new PreBookingScheduler('test-instance');
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with provided instanceId', () => {
      const customScheduler = new PreBookingScheduler('custom-id');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PreBookingScheduler custom-id] Initialized'
      );
    });

    it('should generate random instanceId when not provided', () => {
      const autoScheduler = new PreBookingScheduler();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PreBookingScheduler')
      );
    });
  });

  describe('execute', () => {
    it('should return empty result when no prebookings ready', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([]);

      const result = await scheduler.execute();

      expect(result).toEqual({
        success: true,
        message: 'No prebookings ready',
        details: { total: 0, completed: 0, failed: 0 },
      });

      expect(preBookingService.findReadyToExecute).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });

    it('should execute single prebooking successfully', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(1);
      expect(result.details.completed).toBe(1);
      expect(result.details.failed).toBe(0);

      expect(preBookingService.markCompleted).toHaveBeenCalledWith(
        mockPreBooking.id,
        expect.objectContaining({
          bookingId: 'booking-789',
          bookState: 1,
        })
      );
    });

    it('should execute multiple prebookings with FIFO stagger', async () => {
      const prebookings: PreBooking[] = [
        { ...mockPreBooking, id: '123e4567-e89b-12d3-a456-426614174000' },
        { ...mockPreBooking, id: '223e4567-e89b-12d3-a456-426614174001' },
        { ...mockPreBooking, id: '323e4567-e89b-12d3-a456-426614174002' },
      ];

      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue(prebookings);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(3);
      expect(result.details.completed).toBe(3);
      expect(result.details.failed).toBe(0);

      expect(bookingService.createBooking).toHaveBeenCalledTimes(3);
      expect(preBookingService.markCompleted).toHaveBeenCalledTimes(3);
    });

    it('should handle session not found error', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(null);

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(1);
      expect(result.details.completed).toBe(0);
      expect(result.details.failed).toBe(1);
      expect(result.details.errors).toContain(`${mockPreBooking.id}: Session not found`);

      expect(preBookingService.markFailed).toHaveBeenCalledWith(
        mockPreBooking.id,
        'Session not found'
      );
    });

    it('should handle booking failure with error message', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: -8,
        errorMssg: 'Max bookings reached',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(1);
      expect(result.details.completed).toBe(0);
      expect(result.details.failed).toBe(1);
      expect(result.details.errors).toContain(`${mockPreBooking.id}: Max bookings reached`);

      expect(preBookingService.markFailed).toHaveBeenCalledWith(
        mockPreBooking.id,
        'Max bookings reached',
        { bookState: -8 }
      );
    });

    it('should handle booking API exception', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockRejectedValue(
        new Error('Network error')
      );

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(1);
      expect(result.details.completed).toBe(0);
      expect(result.details.failed).toBe(1);
      expect(result.details.errors).toContain(`${mockPreBooking.id}: Network error`);

      expect(preBookingService.markFailed).toHaveBeenCalledWith(
        mockPreBooking.id,
        'Network error'
      );
    });

    it('should handle mixed success and failure results', async () => {
      const prebookings: PreBooking[] = [
        { ...mockPreBooking, id: '123e4567-e89b-12d3-a456-426614174000', userEmail: 'user1@example.com' },
        { ...mockPreBooking, id: '223e4567-e89b-12d3-a456-426614174001', userEmail: 'user2@example.com' },
        { ...mockPreBooking, id: '323e4567-e89b-12d3-a456-426614174002', userEmail: 'user3@example.com' },
      ];

      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue(prebookings);

      // First succeeds, second fails (no session), third succeeds
      vi.mocked(SupabaseSessionService.getSession)
        .mockResolvedValueOnce(mockSession as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSession as any);

      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.total).toBe(3);
      expect(result.details.completed).toBe(2);
      expect(result.details.failed).toBe(1);
    });

    it('should handle bookState=1 as success even without id', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.completed).toBe(1);
      expect(result.details.failed).toBe(0);
    });

    it('should handle presence of id as success regardless of bookState', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 0,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.success).toBe(true);
      expect(result.details.completed).toBe(1);
      expect(result.details.failed).toBe(0);
    });

    it('should catch and return error when findReadyToExecute throws', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await scheduler.execute();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Database connection failed');
      expect(result.details).toEqual({ total: 0, completed: 0, failed: 0 });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PreBookingScheduler'),
        expect.any(Error)
      );
    });

    it('should include custom error message in result', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: -12,
        errorMssg: 'Too early to book',
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(result.details.errors).toContain(`${mockPreBooking.id}: Too early to book`);
    });

    it('should handle default error message when errorMssg is missing', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 0,
        clasesContratadas: '10',
      });

      const result = await scheduler.execute();

      expect(preBookingService.markFailed).toHaveBeenCalledWith(
        mockPreBooking.id,
        'Booking failed',
        { bookState: 0 }
      );
    });

    it('should log execution time', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      await scheduler.execute();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Execution completed in'),
        expect.any(Object)
      );
    });

    it('should pass correct parameters to createBooking', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      await scheduler.execute();

      expect(bookingService.createBooking).toHaveBeenCalledWith(
        mockPreBooking.bookingData,
        mockSession.cookies
      );
    });

    it('should call getSession with correct user email', async () => {
      vi.mocked(preBookingService.findReadyToExecute).mockResolvedValue([mockPreBooking]);
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession as any);
      vi.mocked(bookingService.createBooking).mockResolvedValue({
        bookState: 1,
        id: 'booking-789',
        clasesContratadas: '10',
      });

      await scheduler.execute();

      expect(SupabaseSessionService.getSession).toHaveBeenCalledWith('test@example.com');
    });
  });
});
