import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSessionService, SessionType } from './supabase-session.service';
import type { SessionData } from './supabase-session.service';
import type { AuthCookie } from './cookie.service';

/**
 * Multi-Session Architecture Test Suite
 *
 * Tests the new multi-session functionality including:
 * - Background sessions (never expire)
 * - Device sessions (expire after 7 days)
 * - Session type filtering
 * - Protection logic
 * - Fingerprint-based operations
 */

// Mock supabaseAdmin with support for multi-session queries
const mockSupabaseChain = () => {
  const chain: any = {
    data: null,
    error: null,
    count: 0,
  };

  chain.upsert = vi.fn().mockReturnValue(Promise.resolve(chain));
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
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

describe('SupabaseSessionService - Multi-Session Architecture', () => {
  const mockEmail = 'test@example.com';
  const mockDeviceFingerprint = 'device-abc123';
  const mockBackgroundFingerprint = 'bg-xyz789';
  const mockToken = 'test-token-123';
  const mockCookies: AuthCookie[] = [
    { name: 'AWSALB', value: 'aws-value' },
    { name: 'PHPSESSID', value: 'session-value' },
  ];

  const createMockSessionData = (sessionType: SessionType, fingerprint: string): SessionData => ({
    email: mockEmail,
    token: mockToken,
    cookies: mockCookies,
    fingerprint,
    sessionType,
    protected: sessionType === 'background',
    createdAt: new Date().toISOString(),
  });

  const createMockSessionRow = (sessionType: SessionType, fingerprint: string) => ({
    id: `${sessionType}-123`,
    user_email: mockEmail,
    aimharder_token: mockToken,
    aimharder_cookies: mockCookies,
    fingerprint,
    session_type: sessionType,
    protected: sessionType === 'background',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeSession - Multi-Session Support', () => {
    it('should store device session with correct session_type', async () => {
      const deviceSession = createMockSessionData('device', mockDeviceFingerprint);
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.storeSession(deviceSession);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('auth_sessions');
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: mockDeviceFingerprint,
          session_type: 'device',
          protected: false,
        }),
        expect.objectContaining({
          onConflict: 'user_email,fingerprint', // Composite key
        })
      );
    });

    it('should store background session with protected flag', async () => {
      const backgroundSession = createMockSessionData('background', mockBackgroundFingerprint);
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.storeSession(backgroundSession);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: mockBackgroundFingerprint,
          session_type: 'background',
          protected: true, // Background sessions are protected
        }),
        expect.objectContaining({
          onConflict: 'user_email,fingerprint',
        })
      );
    });

    it('should allow re-login (UPSERT) for same fingerprint', async () => {
      const deviceSession = createMockSessionData('device', mockDeviceFingerprint);
      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      // First login
      await SupabaseSessionService.storeSession(deviceSession);

      // Re-login with same fingerprint
      await SupabaseSessionService.storeSession(deviceSession);

      expect(chain.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSession - Session Type Filtering', () => {
    it('should return background session by default', async () => {
      const backgroundRow = createMockSessionRow('background', mockBackgroundFingerprint);
      const chain = mockSupabaseChain();
      chain.data = backgroundRow;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail);

      expect(result).toBeDefined();
      expect(result?.sessionType).toBe('background');
      expect(result?.fingerprint).toBe(mockBackgroundFingerprint);
    });

    it('should filter by session type when specified', async () => {
      const deviceRow = createMockSessionRow('device', mockDeviceFingerprint);
      const chain = mockSupabaseChain();
      chain.data = deviceRow;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail, {
        sessionType: 'device',
      });

      expect(result?.sessionType).toBe('device');
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
    });

    it('should filter by fingerprint when specified', async () => {
      const deviceRow = createMockSessionRow('device', mockDeviceFingerprint);
      const chain = mockSupabaseChain();
      chain.data = deviceRow;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getSession(mockEmail, {
        fingerprint: mockDeviceFingerprint,
      });

      expect(result?.fingerprint).toBe(mockDeviceFingerprint);
      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
    });
  });

  describe('getBackgroundSession', () => {
    it('should return only background session', async () => {
      const backgroundRow = createMockSessionRow('background', mockBackgroundFingerprint);
      const chain = mockSupabaseChain();
      chain.data = backgroundRow;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getBackgroundSession(mockEmail);

      expect(result).toBeDefined();
      expect(result?.sessionType).toBe('background');
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'background');
    });

    it('should return null if no background session exists', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = { code: 'PGRST116', message: 'No rows found' };

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getBackgroundSession(mockEmail);

      expect(result).toBeNull();
    });
  });

  describe('getDeviceSessions', () => {
    it('should return all device sessions for a user', async () => {
      const device1 = createMockSessionRow('device', 'device-1');
      const device2 = createMockSessionRow('device', 'device-2');

      const chain = mockSupabaseChain();
      chain.data = [device1, device2];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getDeviceSessions(mockEmail);

      expect(result).toHaveLength(2);
      expect(result[0].sessionType).toBe('device');
      expect(result[1].sessionType).toBe('device');
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
    });

    it('should return empty array if no device sessions exist', async () => {
      const chain = mockSupabaseChain();
      chain.data = null;
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getDeviceSessions(mockEmail);

      expect(result).toEqual([]);
    });
  });

  describe('getAllUserSessions', () => {
    it('should return both background and device sessions', async () => {
      const background = createMockSessionRow('background', mockBackgroundFingerprint);
      const device = createMockSessionRow('device', mockDeviceFingerprint);

      const chain = mockSupabaseChain();
      chain.data = [background, device];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getAllUserSessions(mockEmail);

      expect(result).toHaveLength(2);
      expect(result.some(s => s.sessionType === 'background')).toBe(true);
      expect(result.some(s => s.sessionType === 'device')).toBe(true);
    });
  });

  describe('deleteSession - Protection Logic', () => {
    it('should delete device session by default', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.deleteSession(mockEmail);

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_email', mockEmail);
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
    });

    it('should delete specific session by fingerprint (ignoring sessionType)', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.deleteSession(mockEmail, {
        fingerprint: mockDeviceFingerprint,
        sessionType: 'device', // Should be ignored when fingerprint is provided
      });

      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
      // sessionType should NOT be called when fingerprint is provided
      expect(chain.eq).not.toHaveBeenCalledWith('session_type', 'device');
    });

    it('should delete all sessions of a specific type', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 2;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.deleteSession(mockEmail, {
        sessionType: 'device',
      });

      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
    });

    it('should throw error when trying to delete background without confirmation', async () => {
      await expect(
        SupabaseSessionService.deleteSession(mockEmail, {
          sessionType: 'background',
        })
      ).rejects.toThrow('Background session deletion requires explicit confirmation');
    });

    it('should allow background deletion with confirmation flag', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.deleteSession(mockEmail, {
        sessionType: 'background',
        confirmProtectedDeletion: true,
      });

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'background');
    });
  });

  describe('updateRefreshToken - Fingerprint Targeting', () => {
    it('should update background session by default', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateRefreshToken(mockEmail, 'new-token');

      expect(chain.eq).toHaveBeenCalledWith('session_type', 'background');
    });

    it('should update specific session when fingerprint provided', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateRefreshToken(
        mockEmail,
        'new-token',
        mockDeviceFingerprint
      );

      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
      // Should NOT filter by session_type when fingerprint is provided
      expect(chain.eq).not.toHaveBeenCalledWith('session_type', expect.anything());
    });
  });

  describe('updateCookies - Fingerprint Targeting', () => {
    it('should update background session by default', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateCookies(mockEmail, mockCookies);

      expect(chain.eq).toHaveBeenCalledWith('session_type', 'background');
    });

    it('should update specific session when fingerprint provided', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.updateCookies(
        mockEmail,
        mockCookies,
        mockDeviceFingerprint
      );

      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
    });
  });

  describe('getAllActiveSessions - Multi-Session Support', () => {
    it('should return both background and device sessions', async () => {
      const background = createMockSessionRow('background', mockBackgroundFingerprint);
      const recentDevice = createMockSessionRow('device', mockDeviceFingerprint);

      const chain = mockSupabaseChain();
      chain.data = [background, recentDevice];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getAllActiveSessions();

      expect(result).toHaveLength(2);
      expect(result.some(s => s.sessionType === 'background')).toBe(true);
      expect(result.some(s => s.sessionType === 'device')).toBe(true);
    });

    it('should include old background sessions (never expire)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365); // 1 year old

      const oldBackground = {
        ...createMockSessionRow('background', mockBackgroundFingerprint),
        created_at: oldDate.toISOString(),
      };

      const chain = mockSupabaseChain();
      chain.data = [oldBackground];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const result = await SupabaseSessionService.getAllActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0].sessionType).toBe('background');
    });
  });

  describe('cleanupExpiredSessions - Protection Logic', () => {
    it('should only delete device sessions, not background', async () => {
      const chain = mockSupabaseChain();
      chain.data = [{ id: '1' }, { id: '2' }];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      const count = await SupabaseSessionService.cleanupExpiredSessions();

      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
      expect(count).toBe(2);
    });

    it('should never delete background sessions even if very old', async () => {
      const chain = mockSupabaseChain();
      chain.data = [];
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      await SupabaseSessionService.cleanupExpiredSessions();

      // Verify the query filters for device sessions only
      expect(chain.eq).toHaveBeenCalledWith('session_type', 'device');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support dual login (device + background)', async () => {
      const deviceSession = createMockSessionData('device', mockDeviceFingerprint);
      const backgroundSession = createMockSessionData('background', mockBackgroundFingerprint);

      const chain = mockSupabaseChain();
      chain.error = null;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      // Dual login
      await SupabaseSessionService.storeSession(deviceSession);
      await SupabaseSessionService.storeSession(backgroundSession);

      expect(chain.upsert).toHaveBeenCalledTimes(2);
    });

    it('should support device logout while preserving background', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      // Logout device session
      await SupabaseSessionService.deleteSession(mockEmail, {
        fingerprint: mockDeviceFingerprint,
      });

      // Should delete only the device session
      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
    });

    it('should support token refresh for specific session', async () => {
      const chain = mockSupabaseChain();
      chain.error = null;
      chain.count = 1;

      vi.mocked(supabaseAdmin.from).mockReturnValue(chain);

      // Refresh token for specific device session
      await SupabaseSessionService.updateRefreshToken(
        mockEmail,
        'refreshed-token',
        mockDeviceFingerprint
      );

      expect(chain.eq).toHaveBeenCalledWith('fingerprint', mockDeviceFingerprint);
    });
  });
});
