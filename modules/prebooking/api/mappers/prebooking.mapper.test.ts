import { describe, it, expect } from 'vitest';
import { PreBookingMapper } from './prebooking.mapper';
import { PreBookingApi } from '../models/prebooking.api';
import { PreBooking } from '../../models/prebooking.model';

describe('PreBookingMapper', () => {
  const mockPreBookingApi: PreBookingApi = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_email: 'test@example.com',
    booking_data: {
      day: '20250115',
      familyId: 'family-123',
      id: 'class-1',
      insist: 0,
    },
    available_at: '2025-01-15T08:00:00.000Z',
    box_id: '223e4567-e89b-12d3-a456-426614174000',
    status: 'pending',
    created_at: '2025-01-14T10:00:00.000Z',
    qstash_schedule_id: 'qstash-123',
    result: {
      success: true,
      bookingId: 'booking-456',
      executedAt: '2025-01-15T08:00:05.000Z',
    },
    error_message: null,
    loaded_at: '2025-01-15T07:00:00.000Z',
    executed_at: '2025-01-15T08:00:05.000Z',
  };

  const mockExpectedDomain: PreBooking = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userEmail: 'test@example.com',
    bookingData: {
      day: '20250115',
      familyId: 'family-123',
      id: 'class-1',
      insist: 0,
    },
    availableAt: new Date('2025-01-15T08:00:00.000Z'),
    boxId: '223e4567-e89b-12d3-a456-426614174000',
    status: 'pending',
    createdAt: new Date('2025-01-14T10:00:00.000Z'),
    qstashScheduleId: 'qstash-123',
    result: {
      success: true,
      bookingId: 'booking-456',
      executedAt: new Date('2025-01-15T08:00:05.000Z'),
    },
    errorMessage: undefined,
    loadedAt: new Date('2025-01-15T07:00:00.000Z'),
    executedAt: new Date('2025-01-15T08:00:05.000Z'),
  };

  describe('toDomain', () => {
    it('should map API model to domain model with all fields', () => {
      const result = PreBookingMapper.toDomain(mockPreBookingApi);

      expect(result).toEqual(mockExpectedDomain);
      expect(result.availableAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.loadedAt).toBeInstanceOf(Date);
      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.result?.executedAt).toBeInstanceOf(Date);
    });

    it('should handle minimal API model without optional fields', () => {
      const minimalApi: PreBookingApi = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_email: 'test@example.com',
        booking_data: {
          day: '20250115',
          familyId: 'family-123',
          id: 'class-1',
          insist: 0,
        },
        available_at: '2025-01-15T08:00:00.000Z',
        box_id: '223e4567-e89b-12d3-a456-426614174000',
        status: 'pending',
        created_at: '2025-01-14T10:00:00.000Z',
        qstash_schedule_id: null,
        result: null,
        error_message: null,
        loaded_at: null,
        executed_at: null,
      };

      const result = PreBookingMapper.toDomain(minimalApi);

      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.userEmail).toBe('test@example.com');
      expect(result.qstashScheduleId).toBeUndefined();
      expect(result.result).toBeUndefined();
      expect(result.errorMessage).toBeUndefined();
      expect(result.loadedAt).toBeUndefined();
      expect(result.executedAt).toBeUndefined();
      expect(result.boxId).toBe('223e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle result without success field', () => {
      const apiWithIncompleteResult: PreBookingApi = {
        ...mockPreBookingApi,
        result: {
          bookingId: 'booking-456',
          executedAt: '2025-01-15T08:00:05.000Z',
        } as any,
      };

      const result = PreBookingMapper.toDomain(apiWithIncompleteResult);

      expect(result.result).toBeDefined();
      expect(result.result?.success).toBe(false);
      expect(result.result?.bookingId).toBe('booking-456');
    });

    it('should use current timestamp for executedAt when missing in result', () => {
      const now = Date.now();
      const apiWithResultNoExecutedAt: PreBookingApi = {
        ...mockPreBookingApi,
        result: {
          success: true,
          bookingId: 'booking-456',
        } as any,
      };

      const result = PreBookingMapper.toDomain(apiWithResultNoExecutedAt);

      expect(result.result).toBeDefined();
      expect(result.result?.executedAt).toBeInstanceOf(Date);
      expect(result.result?.executedAt.getTime()).toBeGreaterThanOrEqual(now);
    });

    it('should convert all date strings to Date objects', () => {
      const result = PreBookingMapper.toDomain(mockPreBookingApi);

      expect(result.availableAt).toBeInstanceOf(Date);
      expect(result.availableAt.toISOString()).toBe('2025-01-15T08:00:00.000Z');

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2025-01-14T10:00:00.000Z');

      expect(result.loadedAt).toBeInstanceOf(Date);
      expect(result.loadedAt?.toISOString()).toBe('2025-01-15T07:00:00.000Z');

      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.executedAt?.toISOString()).toBe('2025-01-15T08:00:05.000Z');
    });

    it('should handle error_message field', () => {
      const apiWithError: PreBookingApi = {
        ...mockPreBookingApi,
        error_message: 'Booking failed',
      };

      const result = PreBookingMapper.toDomain(apiWithError);

      expect(result.errorMessage).toBe('Booking failed');
    });

    it('should handle null error_message as undefined', () => {
      const apiWithNullError: PreBookingApi = {
        ...mockPreBookingApi,
        error_message: null,
      };

      const result = PreBookingMapper.toDomain(apiWithNullError);

      expect(result.errorMessage).toBeUndefined();
    });

    it('should preserve booking_data structure', () => {
      const result = PreBookingMapper.toDomain(mockPreBookingApi);

      expect(result.bookingData).toEqual({
        day: '20250115',
        familyId: 'family-123',
        id: 'class-1',
        insist: 0,
      });
    });

    it('should handle different prebooking statuses', () => {
      const statuses: Array<'pending' | 'loaded' | 'executing' | 'completed' | 'failed'> = [
        'pending',
        'loaded',
        'executing',
        'completed',
        'failed',
      ];

      statuses.forEach((status) => {
        const apiWithStatus: PreBookingApi = {
          ...mockPreBookingApi,
          status,
        };

        const result = PreBookingMapper.toDomain(apiWithStatus);

        expect(result.status).toBe(status);
      });
    });
  });

  describe('toDomainList', () => {
    it('should map empty array to empty array', () => {
      const result = PreBookingMapper.toDomainList([]);

      expect(result).toEqual([]);
    });

    it('should map single item array', () => {
      const result = PreBookingMapper.toDomainList([mockPreBookingApi]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockExpectedDomain);
    });

    it('should map multiple items', () => {
      const secondApi: PreBookingApi = {
        ...mockPreBookingApi,
        id: '223e4567-e89b-12d3-a456-426614174001',
        user_email: 'another@example.com',
      };

      const result = PreBookingMapper.toDomainList([mockPreBookingApi, secondApi]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result[1].id).toBe('223e4567-e89b-12d3-a456-426614174001');
      expect(result[0].userEmail).toBe('test@example.com');
      expect(result[1].userEmail).toBe('another@example.com');
    });

    it('should map each item correctly with different data', () => {
      const items: PreBookingApi[] = [
        {
          ...mockPreBookingApi,
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'pending',
        },
        {
          ...mockPreBookingApi,
          id: '223e4567-e89b-12d3-a456-426614174001',
          status: 'loaded',
        },
        {
          ...mockPreBookingApi,
          id: '323e4567-e89b-12d3-a456-426614174002',
          status: 'completed',
        },
      ];

      const result = PreBookingMapper.toDomainList(items);

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('pending');
      expect(result[1].status).toBe('loaded');
      expect(result[2].status).toBe('completed');
    });

    it('should preserve all Date objects in mapped list', () => {
      const result = PreBookingMapper.toDomainList([mockPreBookingApi]);

      expect(result[0].availableAt).toBeInstanceOf(Date);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].loadedAt).toBeInstanceOf(Date);
      expect(result[0].executedAt).toBeInstanceOf(Date);
    });
  });
});
