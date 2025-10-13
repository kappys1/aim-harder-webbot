import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreBookingService } from './prebooking.service';
import { supabaseAdmin } from '@/core/database/supabase';
import { PreBookingMapper } from '../mappers/prebooking.mapper';
import type { CreatePreBookingInput, UpdatePreBookingStatusInput } from '../../models/prebooking.model';

vi.mock('@/core/database/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../mappers/prebooking.mapper');

describe('PreBookingService', () => {
  let service: PreBookingService;
  let mockSupabase: any;

  const mockPreBookingApi = {
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
  };

  const mockPreBookingDomain = {
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
    status: 'pending' as const,
    createdAt: new Date('2025-01-14T10:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PreBookingService();

    mockSupabase = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(mockSupabase as any);
    vi.mocked(PreBookingMapper.toDomain).mockReturnValue(mockPreBookingDomain as any);
    vi.mocked(PreBookingMapper.toDomainList).mockReturnValue([mockPreBookingDomain] as any);
  });

  describe('create', () => {
    it('should create a new prebooking', async () => {
      const input: CreatePreBookingInput = {
        userEmail: 'test@example.com',
        bookingData: mockPreBookingApi.booking_data,
        availableAt: new Date('2025-01-15T08:00:00.000Z'),
        boxId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockSupabase.single.mockResolvedValue({
        data: mockPreBookingApi,
        error: null,
      });

      const result = await service.create(input);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('prebookings');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_email: input.userEmail,
        booking_data: input.bookingData,
        available_at: input.availableAt.toISOString(),
        box_id: input.boxId,
        status: 'pending',
      });
      expect(result).toEqual(mockPreBookingDomain);
    });

    it('should throw error on create failure', async () => {
      const input: CreatePreBookingInput = {
        userEmail: 'test@example.com',
        bookingData: mockPreBookingApi.booking_data,
        availableAt: new Date('2025-01-15T08:00:00.000Z'),
        boxId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.create(input)).rejects.toThrow('Failed to create prebooking: Database error');
    });
  });

  describe('updateQStashScheduleId', () => {
    it('should update qstash schedule id', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.updateQStashScheduleId('123e4567-e89b-12d3-a456-426614174000', 'schedule-456');

      expect(mockSupabase.update).toHaveBeenCalledWith({
        qstash_schedule_id: 'schedule-456',
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw error on update failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        service.updateQStashScheduleId('123e4567-e89b-12d3-a456-426614174000', 'schedule-456')
      ).rejects.toThrow('Failed to update qstash_schedule_id: Update failed');
    });
  });

  describe('findPendingInTimeRange', () => {
    it('should find pending prebookings in time range', async () => {
      const startTime = new Date('2025-01-15T08:00:00.000Z');
      const endTime = new Date('2025-01-15T09:00:00.000Z');

      mockSupabase.order.mockResolvedValue({
        data: [mockPreBookingApi],
        error: null,
      });

      const result = await service.findPendingInTimeRange(startTime, endTime);

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockSupabase.gte).toHaveBeenCalledWith('available_at', startTime.toISOString());
      expect(mockSupabase.lte).toHaveBeenCalledWith('available_at', endTime.toISOString());
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(result).toEqual([mockPreBookingDomain]);
    });

    it('should return empty array when no prebookings found', async () => {
      const startTime = new Date('2025-01-15T08:00:00.000Z');
      const endTime = new Date('2025-01-15T09:00:00.000Z');

      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.findPendingInTimeRange(startTime, endTime);

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const startTime = new Date('2025-01-15T08:00:00.000Z');
      const endTime = new Date('2025-01-15T09:00:00.000Z');

      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.findPendingInTimeRange(startTime, endTime)).rejects.toThrow(
        'Failed to find pending prebookings: Query failed'
      );
    });
  });

  describe('updateStatus', () => {
    it('should update prebooking status', async () => {
      const input: UpdatePreBookingStatusInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        executedAt: new Date('2025-01-15T08:30:00.000Z'),
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockPreBookingApi, status: 'completed' },
        error: null,
      });

      const result = await service.updateStatus(input);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'completed',
        executed_at: input.executedAt.toISOString(),
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
      expect(result).toEqual(mockPreBookingDomain);
    });

    it('should include result in update when provided', async () => {
      const input: UpdatePreBookingStatusInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        result: {
          success: true,
          bookingId: 'booking-456',
          bookState: 1,
          message: 'Success',
          executedAt: new Date('2025-01-15T08:30:00.000Z'),
        },
      };

      mockSupabase.single.mockResolvedValue({
        data: mockPreBookingApi,
        error: null,
      });

      await service.updateStatus(input);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          result: expect.objectContaining({
            success: true,
            bookingId: 'booking-456',
          }),
        })
      );
    });

    it('should throw error on update failure', async () => {
      const input: UpdatePreBookingStatusInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(service.updateStatus(input)).rejects.toThrow(
        'Failed to update prebooking status: Update failed'
      );
    });
  });

  describe('findByUser', () => {
    it('should find prebookings by user email', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [mockPreBookingApi],
        error: null,
      });

      const result = await service.findByUser('test@example.com');

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_email', 'test@example.com');
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([mockPreBookingDomain]);
    });

    it('should filter by boxId when provided', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [mockPreBookingApi],
        error: null,
      });

      await service.findByUser('test@example.com', '223e4567-e89b-12d3-a456-426614174000');

      expect(mockSupabase.eq).toHaveBeenCalledWith('box_id', '223e4567-e89b-12d3-a456-426614174000');
    });

    it('should return empty array when no prebookings found', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.findByUser('test@example.com');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.findByUser('test@example.com')).rejects.toThrow(
        'Failed to find user prebookings: Query failed'
      );
    });
  });

  describe('delete', () => {
    it('should delete a prebooking', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.delete('123e4567-e89b-12d3-a456-426614174000');

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw error on delete failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.delete('prebooking-123')).rejects.toThrow(
        'Failed to delete prebooking: Delete failed'
      );
    });
  });

  describe('findById', () => {
    it('should find a prebooking by id', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockPreBookingApi,
        error: null,
      });

      const result = await service.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
      expect(result).toEqual(mockPreBookingDomain);
    });

    it('should return null when prebooking not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Query failed', code: 'OTHER_ERROR' },
      });

      await expect(service.findById('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(
        'Failed to find prebooking: Query failed'
      );
    });
  });

  describe('countPendingByUser', () => {
    it('should count pending prebookings for user', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({
        count: 5,
        error: null,
      });

      const mockCountQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabaseAdmin.from).mockReturnValue(mockCountQuery as any);

      const result = await service.countPendingByUser('test@example.com');

      expect(mockCountQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(5);
    });

    it('should return 0 when count is null', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({
        count: null,
        error: null,
      });

      const mockCountQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabaseAdmin.from).mockReturnValue(mockCountQuery as any);

      const result = await service.countPendingByUser('test@example.com');

      expect(result).toBe(0);
    });

    it('should throw error on count failure', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'Count failed' },
      });

      const mockCountQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabaseAdmin.from).mockReturnValue(mockCountQuery as any);

      await expect(service.countPendingByUser('test@example.com')).rejects.toThrow(
        'Failed to count pending prebookings: Count failed'
      );
    });
  });

  describe('claimPrebooking', () => {
    it('should claim a pending prebooking atomically', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockPreBookingApi,
        error: null,
      });

      const result = await service.claimPrebooking('123e4567-e89b-12d3-a456-426614174000');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'loaded',
        })
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
      expect(result).toEqual(mockPreBookingDomain);
    });

    it('should return null if already claimed', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.claimPrebooking('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBeNull();
    });

    it('should throw error on claim failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Claim failed', code: 'OTHER_ERROR' },
      });

      await expect(service.claimPrebooking('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(
        'Failed to claim prebooking: Claim failed'
      );
    });
  });

  describe('findReadyToExecute', () => {
    it('should find prebookings ready to execute now', async () => {
      const now = new Date('2025-01-15T08:00:00.000Z');

      mockSupabase.limit.mockResolvedValue({
        data: [mockPreBookingApi],
        error: null,
      });

      const result = await service.findReadyToExecute(now);

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockSupabase.lte).toHaveBeenCalledWith('available_at', now.toISOString());
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(mockSupabase.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual([mockPreBookingDomain]);
    });

    it('should return empty array when none ready', async () => {
      const now = new Date('2025-01-15T08:00:00.000Z');

      mockSupabase.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.findReadyToExecute(now);

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const now = new Date('2025-01-15T08:00:00.000Z');

      mockSupabase.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.findReadyToExecute(now)).rejects.toThrow(
        'Failed to find ready prebookings: Query failed'
      );
    });
  });

  describe('markCompleted', () => {
    it('should mark prebooking as completed with result', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.markCompleted('123e4567-e89b-12d3-a456-426614174000', {
        bookingId: 'booking-456',
        bookState: 1,
        message: 'Success',
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          result: expect.objectContaining({
            success: true,
            bookingId: 'booking-456',
            bookState: 1,
            message: 'Success',
          }),
        })
      );
    });

    it('should throw error on mark completed failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        service.markCompleted('123e4567-e89b-12d3-a456-426614174000', { bookingId: 'booking-456' })
      ).rejects.toThrow('Failed to mark completed: Update failed');
    });
  });

  describe('markFailed', () => {
    it('should mark prebooking as failed with error message', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.markFailed('123e4567-e89b-12d3-a456-426614174000', 'Booking failed', {
        bookState: -1,
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Booking failed',
          result: expect.objectContaining({
            success: false,
            bookState: -1,
            message: 'Booking failed',
          }),
        })
      );
    });

    it('should throw error on mark failed failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(service.markFailed('123e4567-e89b-12d3-a456-426614174000', 'Error')).rejects.toThrow(
        'Failed to mark failed: Update failed'
      );
    });
  });
});
