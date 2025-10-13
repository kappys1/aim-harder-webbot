import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxAccessService } from './box-access.service';
import { supabase } from '@/core/database/supabase';

vi.mock('@/core/database/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('BoxAccessService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabase);
  });

  describe('validateAccess', () => {
    it('should return true when user has access to box', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'access-123' },
        error: null,
      });

      const result = await BoxAccessService.validateAccess(
        'user@example.com',
        'box-123'
      );

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('user_boxes');
      expect(mockSupabase.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_email', 'user@example.com');
      expect(mockSupabase.eq).toHaveBeenCalledWith('box_id', 'box-123');
    });

    it('should return false when no rows found (PGRST116)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await BoxAccessService.validateAccess(
        'user@example.com',
        'box-123'
      );

      expect(result).toBe(false);
    });

    it('should throw error for other database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      await expect(
        BoxAccessService.validateAccess('user@example.com', 'box-123')
      ).rejects.toThrow('Failed to validate access: Database error');
    });

    it('should return false when data is null but no error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await BoxAccessService.validateAccess(
        'user@example.com',
        'box-123'
      );

      expect(result).toBe(false);
    });

    it('should handle different user emails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'access-456' },
        error: null,
      });

      await BoxAccessService.validateAccess('different@example.com', 'box-123');

      expect(mockSupabase.eq).toHaveBeenCalledWith('user_email', 'different@example.com');
    });

    it('should handle different box IDs', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'access-789' },
        error: null,
      });

      await BoxAccessService.validateAccess('user@example.com', 'box-456');

      expect(mockSupabase.eq).toHaveBeenCalledWith('box_id', 'box-456');
    });
  });

  describe('requireAccess', () => {
    it('should not throw when user has access', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'access-123' },
        error: null,
      });

      await expect(
        BoxAccessService.requireAccess('user@example.com', 'box-123')
      ).resolves.toBeUndefined();
    });

    it('should throw error when user does not have access', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      await expect(
        BoxAccessService.requireAccess('user@example.com', 'box-123')
      ).rejects.toThrow('User does not have access to this box');
    });

    it('should propagate database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      await expect(
        BoxAccessService.requireAccess('user@example.com', 'box-123')
      ).rejects.toThrow('Failed to validate access: Database error');
    });

    it('should call validateAccess internally', async () => {
      const validateAccessSpy = vi.spyOn(BoxAccessService, 'validateAccess');

      mockSupabase.single.mockResolvedValue({
        data: { id: 'access-123' },
        error: null,
      });

      await BoxAccessService.requireAccess('user@example.com', 'box-123');

      expect(validateAccessSpy).toHaveBeenCalledWith('user@example.com', 'box-123');
    });
  });

  describe('getUserBoxIds', () => {
    it('should return array of box IDs for user', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { box_id: 'box-123' },
            { box_id: 'box-456' },
            { box_id: 'box-789' },
          ],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      const result = await BoxAccessService.getUserBoxIds('user@example.com');

      expect(result).toEqual(['box-123', 'box-456', 'box-789']);
      expect(supabase.from).toHaveBeenCalledWith('user_boxes');
      expect(mockSupabaseList.select).toHaveBeenCalledWith('box_id');
      expect(mockSupabaseList.eq).toHaveBeenCalledWith('user_email', 'user@example.com');
    });

    it('should return empty array when user has no boxes', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      const result = await BoxAccessService.getUserBoxIds('user@example.com');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      const result = await BoxAccessService.getUserBoxIds('user@example.com');

      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      await expect(
        BoxAccessService.getUserBoxIds('user@example.com')
      ).rejects.toThrow('Failed to fetch user box IDs: Database error');
    });

    it('should handle single box', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ box_id: 'box-123' }],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      const result = await BoxAccessService.getUserBoxIds('user@example.com');

      expect(result).toEqual(['box-123']);
    });

    it('should handle different user emails', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ box_id: 'box-123' }],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      await BoxAccessService.getUserBoxIds('different@example.com');

      expect(mockSupabaseList.eq).toHaveBeenCalledWith('user_email', 'different@example.com');
    });

    it('should preserve order of box IDs', async () => {
      const mockSupabaseList = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { box_id: 'box-aaa' },
            { box_id: 'box-zzz' },
            { box_id: 'box-mmm' },
          ],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseList);

      const result = await BoxAccessService.getUserBoxIds('user@example.com');

      expect(result).toEqual(['box-aaa', 'box-zzz', 'box-mmm']);
    });
  });
});
