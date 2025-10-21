/**
 * Tests for Device Session functionality
 *
 * CRITICAL: These tests verify the device session fixes that prevent token desync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseSessionService } from './supabase-session.service';

// Mock Supabase admin client
vi.mock('@/core/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

describe('SupabaseSessionService - Device Session Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDeviceSession()', () => {
    it('should call getSession with device sessionType', async () => {
      const getSessionSpy = vi.spyOn(SupabaseSessionService, 'getSession');

      await SupabaseSessionService.getDeviceSession('test@example.com');

      expect(getSessionSpy).toHaveBeenCalledWith('test@example.com', {
        sessionType: 'device',
      });
    });

    it('should call getSession with device sessionType and fingerprint when provided', async () => {
      const getSessionSpy = vi.spyOn(SupabaseSessionService, 'getSession');
      const fingerprint = 'device-fp-123';

      await SupabaseSessionService.getDeviceSession('test@example.com', fingerprint);

      expect(getSessionSpy).toHaveBeenCalledWith('test@example.com', {
        sessionType: 'device',
        fingerprint,
      });
    });
  });

  describe('getAllActiveSessions()', () => {
    it('should only fetch background sessions (not device sessions)', async () => {
      // This test verifies the CRITICAL FIX where cron should only update background sessions

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          expect(field).toBe('session_type');
          expect(value).toBe('background');
          return {
            then: vi.fn((cb) => cb({ data: [], error: null })),
          };
        }),
      }));

      const { supabaseAdmin } = await import('@/core/supabase/server');
      (supabaseAdmin.from as any) = mockFrom;

      await SupabaseSessionService.getAllActiveSessions();

      expect(mockFrom).toHaveBeenCalledWith('auth_sessions');
    });
  });

  describe('updateRefreshToken() - count=0 detection', () => {
    it('should throw error when no sessions are updated (count=0)', async () => {
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((cb) => cb({ error: null, count: 0 })),
      }));

      const mockSelect = vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((cb) => cb({ data: [], error: null })),
      }));

      const mockFrom = vi.fn((table) => {
        if (table === 'auth_sessions') {
          return {
            update: mockUpdate,
            select: mockSelect,
          };
        }
      });

      const { supabaseAdmin } = await import('@/core/supabase/server');
      (supabaseAdmin.from as any) = mockFrom;

      await expect(
        SupabaseSessionService.updateRefreshToken(
          'test@example.com',
          'new-token-123',
          'device-fp-123'
        )
      ).rejects.toThrow('Session not found for update');
    });
  });
});
