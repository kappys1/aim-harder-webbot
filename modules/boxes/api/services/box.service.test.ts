import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxService } from './box.service';
import { supabase } from '@/core/database/supabase';
import { BoxUrlUtils } from '../../utils/url.utils';
import type { DetectedBoxInfo } from '../../models/box.model';
import type { BoxApiResponse, BoxWithAccessApiResponse } from '../models/box.api';

vi.mock('@/core/database/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../utils/url.utils');

describe('BoxService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabase);
    vi.mocked(BoxUrlUtils.buildBaseUrl).mockReturnValue('https://mybox.aimharder.com');
  });

  describe('upsertBox', () => {
    const mockDetectedBox: DetectedBoxInfo = {
      boxId: '10122',
      subdomain: 'mybox',
      name: 'My Box',
      phone: '+34123456789',
      email: 'info@mybox.com',
      address: '123 Main St',
      website: 'https://mybox.com',
      logoUrl: 'https://cdn.example.com/logo.png',
    };

    const mockExistingBox: BoxApiResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      box_id: '10122',
      subdomain: 'mybox',
      name: 'My Box',
      phone: '+34123456789',
      email: 'info@mybox.com',
      address: '123 Main St',
      website: 'https://mybox.com',
      logo_url: 'https://cdn.example.com/logo.png',
      base_url: 'https://mybox.aimharder.com',
      created_at: '2025-01-01T10:00:00.000Z',
      updated_at: '2025-01-15T12:30:00.000Z',
    };

    it('should return existing box when box_id already exists', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockExistingBox,
        error: null,
      });

      const result = await BoxService.upsertBox(mockDetectedBox);

      expect(result).toEqual(mockExistingBox);
      expect(supabase.from).toHaveBeenCalledWith('boxes');
      expect(mockSupabase.eq).toHaveBeenCalledWith('box_id', '10122');
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should create new box when box_id does not exist', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockExistingBox,
          error: null,
        });

      const result = await BoxService.upsertBox(mockDetectedBox);

      expect(result).toEqual(mockExistingBox);
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        box_id: '10122',
        subdomain: 'mybox',
        name: 'My Box',
        phone: '+34123456789',
        email: 'info@mybox.com',
        address: '123 Main St',
        website: 'https://mybox.com',
        logo_url: 'https://cdn.example.com/logo.png',
        base_url: 'https://mybox.aimharder.com',
      });
    });

    it('should build base URL using BoxUrlUtils', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: mockExistingBox, error: null });

      await BoxService.upsertBox(mockDetectedBox);

      expect(BoxUrlUtils.buildBaseUrl).toHaveBeenCalledWith('mybox');
    });

    it('should throw error when insert fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(BoxService.upsertBox(mockDetectedBox)).rejects.toThrow(
        'Failed to create box: Insert failed'
      );
    });

    it('should handle box with minimal info', async () => {
      const minimalBox: DetectedBoxInfo = {
        boxId: '10123',
        subdomain: 'minimal',
        name: 'Minimal Box',
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: mockExistingBox, error: null });

      await BoxService.upsertBox(minimalBox);

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        box_id: '10123',
        subdomain: 'minimal',
        name: 'Minimal Box',
        phone: undefined,
        email: undefined,
        address: undefined,
        website: undefined,
        logo_url: undefined,
        base_url: 'https://mybox.aimharder.com',
      });
    });
  });

  describe('linkUserToBox', () => {
    it('should link user to box successfully', async () => {
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockInsert as any);

      await expect(
        BoxService.linkUserToBox('user@example.com', 'box-123')
      ).resolves.toBeUndefined();

      expect(supabase.from).toHaveBeenCalledWith('user_boxes');
      expect(mockInsert.insert).toHaveBeenCalledWith({
        user_email: 'user@example.com',
        box_id: 'box-123',
        detected_at: expect.any(String),
      });
    });

    it('should ignore duplicate key violations', async () => {
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockInsert as any);

      await expect(
        BoxService.linkUserToBox('user@example.com', 'box-123')
      ).resolves.toBeUndefined();
    });

    it('should throw error for non-duplicate errors', async () => {
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockInsert as any);

      await expect(
        BoxService.linkUserToBox('user@example.com', 'box-123')
      ).rejects.toThrow('Failed to link user to box: Database error');
    });

    it('should use current timestamp for detected_at', async () => {
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockInsert as any);

      const beforeCall = Date.now();
      await BoxService.linkUserToBox('user@example.com', 'box-123');
      const afterCall = Date.now();

      const insertCall = mockInsert.insert.mock.calls[0][0];
      expect(insertCall.detected_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const detectedAtMs = new Date(insertCall.detected_at).getTime();
      expect(detectedAtMs).toBeGreaterThanOrEqual(beforeCall);
      expect(detectedAtMs).toBeLessThanOrEqual(afterCall);
    });
  });

  describe('getUserBoxes', () => {
    const mockBoxWithAccess: any = {
      last_accessed_at: '2025-01-15T14:00:00.000Z',
      boxes: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        box_id: '10122',
        subdomain: 'mybox',
        name: 'My Box',
        base_url: 'https://mybox.aimharder.com',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-15T12:30:00.000Z',
      },
    };

    it('should return user boxes with access info', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [mockBoxWithAccess],
        error: null,
      });

      const result = await BoxService.getUserBoxes('user@example.com');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockBoxWithAccess.boxes,
        last_accessed_at: '2025-01-15T14:00:00.000Z',
      });
    });

    it('should order by last_accessed_at DESC', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await BoxService.getUserBoxes('user@example.com');

      expect(mockSupabase.order).toHaveBeenCalledWith('last_accessed_at', {
        ascending: false,
        nullsFirst: false,
      });
    });

    it('should return empty array when no boxes found', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await BoxService.getUserBoxes('user@example.com');

      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(BoxService.getUserBoxes('user@example.com')).rejects.toThrow(
        'Failed to fetch user boxes: Database error'
      );
    });

    it('should handle multiple boxes', async () => {
      const mockBoxes = [
        { ...mockBoxWithAccess, last_accessed_at: '2025-01-15T14:00:00.000Z' },
        { ...mockBoxWithAccess, last_accessed_at: '2025-01-14T10:00:00.000Z' },
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockBoxes,
        error: null,
      });

      const result = await BoxService.getUserBoxes('user@example.com');

      expect(result).toHaveLength(2);
    });
  });

  describe('getBoxById', () => {
    const mockBox: BoxApiResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      box_id: '10122',
      subdomain: 'mybox',
      name: 'My Box',
      base_url: 'https://mybox.aimharder.com',
      created_at: '2025-01-01T10:00:00.000Z',
      updated_at: '2025-01-15T12:30:00.000Z',
    };

    it('should return box by ID', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockBox,
        error: null,
      });

      const result = await BoxService.getBoxById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockBox);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return null when box not found (PGRST116)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await BoxService.getBoxById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error for other database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      await expect(BoxService.getBoxById('box-123')).rejects.toThrow(
        'Failed to fetch box: Database error'
      );
    });
  });

  describe('updateLastAccessed', () => {
    it('should update last accessed timestamp', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({ error: null });

      const mockUpdate = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockUpdate as any);

      await expect(
        BoxService.updateLastAccessed('user@example.com', 'box-123')
      ).resolves.toBeUndefined();

      expect(mockUpdate.update).toHaveBeenCalledWith({
        last_accessed_at: expect.any(String),
      });
    });

    it('should throw error on update failure', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({
        error: { message: 'Update failed' },
      });

      const mockUpdate = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockUpdate as any);

      await expect(
        BoxService.updateLastAccessed('user@example.com', 'box-123')
      ).rejects.toThrow('Failed to update last accessed: Update failed');
    });

    it('should use current timestamp', async () => {
      const mockEqChain = vi.fn().mockResolvedValue({ error: null });

      const mockUpdate = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqChain,
          }),
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockUpdate as any);

      const beforeCall = Date.now();
      await BoxService.updateLastAccessed('user@example.com', 'box-123');
      const afterCall = Date.now();

      const updateCall = mockUpdate.update.mock.calls[0][0];
      expect(updateCall.last_accessed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const lastAccessedMs = new Date(updateCall.last_accessed_at).getTime();
      expect(lastAccessedMs).toBeGreaterThanOrEqual(beforeCall);
      expect(lastAccessedMs).toBeLessThanOrEqual(afterCall);
    });
  });

  describe('getUserDefaultBox', () => {
    it('should return first box when user has boxes', async () => {
      const mockBoxes: BoxWithAccessApiResponse[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          box_id: '10122',
          subdomain: 'box1',
          name: 'Box 1',
          base_url: 'https://box1.aimharder.com',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-15T12:30:00.000Z',
          last_accessed_at: '2025-01-15T14:00:00.000Z',
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174001',
          box_id: '10123',
          subdomain: 'box2',
          name: 'Box 2',
          base_url: 'https://box2.aimharder.com',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-15T12:30:00.000Z',
          last_accessed_at: '2025-01-14T12:00:00.000Z',
        },
      ];

      vi.spyOn(BoxService, 'getUserBoxes').mockResolvedValue(mockBoxes);

      const result = await BoxService.getUserDefaultBox('user@example.com');

      expect(result).toEqual(mockBoxes[0]);
      expect(BoxService.getUserBoxes).toHaveBeenCalledWith('user@example.com');
    });

    it('should return null when user has no boxes', async () => {
      vi.spyOn(BoxService, 'getUserBoxes').mockResolvedValue([]);

      const result = await BoxService.getUserDefaultBox('user@example.com');

      expect(result).toBeNull();
    });

    it('should call getUserBoxes internally', async () => {
      const getUserBoxesSpy = vi.spyOn(BoxService, 'getUserBoxes').mockResolvedValue([]);

      await BoxService.getUserDefaultBox('user@example.com');

      expect(getUserBoxesSpy).toHaveBeenCalledWith('user@example.com');
    });
  });
});
