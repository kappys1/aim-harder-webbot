import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSessionService } from './supabase-session.service';
import type { SessionData } from './supabase-session.service';
import type { AuthCookie } from './cookie.service';

// Mock supabaseAdmin
const mockSupabaseChain = () => {
  const chain: any = {
    data: null,
    error: null,
  };

  chain.upsert = vi.fn().mockReturnValue(Promise.resolve(chain));
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(Promise.resolve(chain));
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(Promise.resolve(chain));
  chain.lt = vi.fn().mockReturnValue(chain);

  return chain;
};

vi.mock('@/core/database/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from '@/core/database/supabase';

describe('SupabaseSessionService', () => {
  const mockEmail = 'test@example.com';
  const mockToken = 'test-token-123';
  const mockCookies: AuthCookie[] = [
    { name: 'AWSALB', value: 'aws-value' },
    { name: 'PHPSESSID', value: 'session-value' },
  ];

  const mockSessionData: SessionData = {
    email: mockEmail,
    token: mockToken,
    cookies: mockCookies,
    createdAt: new Date().toISOString(),
  };

  const mockSessionRow = {
    id: '123',
    user_email: mockEmail,
    aimharder_token: mockToken,
    aimharder_cookies: [
      { name: 'AWSALB', value: 'aws-value' },
      { name: 'PHPSESSID', value: 'session-value' },
    ],
    created_at: mockSessionData.createdAt,
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeSession', () => {
    it('should store session successfully', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.storeSession(mockSessionData);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('auth_sessions');
      expect(chain.upsert).toHaveBeenCalled();
    });

    it('should throw error if storage fails', async () => {
      const chain = mockSupabaseChain();
      chain.error = { message: 'Database error' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await expect(
        SupabaseSessionService.storeSession(mockSessionData)
      ).rejects.toThrow('Failed to store session');
    });
  });

  describe('getSession', () => {
    it('should retrieve session successfully', async () => {
      const chain = mockSupabaseChain();
      chain.data = mockSessionRow;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail);

      expect(result).toEqual({
        email: mockEmail,
        token: mockToken,
        cookies: mockCookies,
        createdAt: mockSessionRow.created_at,
        updatedAt: mockSessionRow.updated_at,
        lastRefreshDate: undefined,
        refreshCount: undefined,
        lastRefreshError: undefined,
        fingerprint: undefined,
        isAdmin: false,
      });
    });

    it('should return null when session not found (PGRST116)', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { code: 'PGRST116', message: 'No rows found' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail);

      expect(result).toBeNull();
    });

    it('should return null on database errors', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { message: 'Database error' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail);

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.deleteSession(mockEmail);

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_email', mockEmail);
    });

    it('should throw error if deletion fails', async () => {
      const chain = mockSupabaseChain();
      chain.error = { message: 'Delete failed' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await expect(
        SupabaseSessionService.deleteSession(mockEmail)
      ).rejects.toThrow('Failed to delete session');
    });
  });

  describe('updateSession', () => {
    it('should update token and cookies', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateSession(mockEmail, {
        token: 'new-token',
        cookies: mockCookies,
      });

      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_email', mockEmail);
    });

    it('should throw error if update fails', async () => {
      const chain = mockSupabaseChain();
      chain.error = { message: 'Update failed' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await expect(
        SupabaseSessionService.updateSession(mockEmail, { token: 'new-token' })
      ).rejects.toThrow('Failed to update session');
    });
  });

  describe('updateRefreshToken', () => {
    it('should update refresh token successfully', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateRefreshToken(
        mockEmail,
        'refresh-token-123',
        'fingerprint-xyz'
      );

      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_email', mockEmail);
    });

    it('should throw error if update fails', async () => {
      const chain = mockSupabaseChain();
      chain.error = { message: 'Update failed' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await expect(
        SupabaseSessionService.updateRefreshToken(mockEmail, 'refresh-token')
      ).rejects.toThrow('Failed to update refresh token');
    });
  });

  describe('updateCookies', () => {
    it('should update cookies successfully', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateCookies(mockEmail, mockCookies);

      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_email', mockEmail);
    });

    it('should throw error if update fails', async () => {
      const chain = mockSupabaseChain();
      chain.error = { message: 'Update failed' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await expect(
        SupabaseSessionService.updateCookies(mockEmail, mockCookies)
      ).rejects.toThrow('Failed to update cookies');
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session (< 7 days old)', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

      const recentSession = {
        ...mockSessionRow,
        created_at: recentDate.toISOString(),
      };

      const chain = mockSupabaseChain();
      chain.data = recentSession;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.isSessionValid(mockEmail);

      expect(result).toBe(true);
    });

    it('should return false for expired session (> 7 days old)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const oldSession = {
        ...mockSessionRow,
        created_at: oldDate.toISOString(),
      };

      const chain = mockSupabaseChain();
      chain.data = oldSession;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.isSessionValid(mockEmail);

      expect(result).toBe(false);
    });

    it('should return false when session not found', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { code: 'PGRST116' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.isSessionValid(mockEmail);

      expect(result).toBe(false);
    });
  });

  describe('getAllActiveSessions', () => {
    it('should return all active sessions', async () => {
      const sessions = [mockSessionRow, { ...mockSessionRow, user_email: 'other@example.com' }];

      const chain = mockSupabaseChain();
      chain.data = sessions;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getAllActiveSessions();

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe(mockEmail);
      expect(result[1].email).toBe('other@example.com');
    });

    it('should return empty array on error', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { message: 'Query error' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getAllActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions and return count', async () => {
      const deletedSessions = [{ id: '1' }, { id: '2' }, { id: '3' }];

      const chain = mockSupabaseChain();
      chain.data = deletedSessions;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const count = await SupabaseSessionService.cleanupExpiredSessions();

      expect(count).toBe(3);
    });

    it('should return 0 on error', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { message: 'Delete error' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const count = await SupabaseSessionService.cleanupExpiredSessions();

      expect(count).toBe(0);
    });
  });

  describe('updateRefreshData', () => {
    it('should update refresh data on success', async () => {
      // First call for getSession
      const getChain = mockSupabaseChain();
      getChain.data = mockSessionRow;
      getChain.error = null;

      // Second call for update
      const updateChain = mockSupabaseChain();
      updateChain.error = null;

      vi.mocked(supabaseAdmin.from)
        .mockReturnValueOnce(getChain)
        .mockReturnValueOnce(updateChain);

      await SupabaseSessionService.updateRefreshData(mockEmail, true);

      expect(updateChain.update).toHaveBeenCalled();
      expect(updateChain.eq).toHaveBeenCalledWith('user_email', mockEmail);
    });

    it('should do nothing if session not found', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { code: 'PGRST116' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateRefreshData(mockEmail, true);

      // Should only be called once (for getSession), not for update
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    });
  });
});
