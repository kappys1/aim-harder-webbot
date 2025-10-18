import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AimharderAuthService } from './aimharder-auth.service';
import { SupabaseSessionService } from './supabase-session.service';
import type { AimharderLoginRequest } from './aimharder-auth.service';

/**
 * Multi-Session Integration Tests
 *
 * Tests the complete integration of dual login/logout flows:
 * - Dual login (device + background sessions)
 * - Device logout (preserves background)
 * - Re-login scenarios
 * - Token refresh flows
 */

// Mock external dependencies
vi.mock('./aimharder-refresh.service', () => ({
  AimharderRefreshService: {
    login: vi.fn(),
    refreshSession: vi.fn(),
  },
}));

vi.mock('@/core/database/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('./html-parser.service', () => ({
  HtmlParserService: {
    parseLoginResponse: vi.fn(),
  },
}));

vi.mock('@/common/utils/background-fingerprint.utils', () => ({
  generateBackgroundFingerprint: vi.fn((email) => `bg-${email.split('@')[0]}`),
}));

import { AimharderRefreshService } from './aimharder-refresh.service';
import { HtmlParserService } from './html-parser.service';
import { generateBackgroundFingerprint } from '@/common/utils/background-fingerprint.utils';

describe('Multi-Session Integration Tests', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockDeviceFingerprint = 'device-abc123';
  const mockBackgroundFingerprint = 'bg-test';

  const mockLoginRequest: AimharderLoginRequest = {
    email: mockEmail,
    password: mockPassword,
    fingerprint: mockDeviceFingerprint,
  };

  const mockLoginResponse = {
    success: true,
    message: 'Login successful',
  };

  const mockTokenData = {
    token: 'test-token',
    tokenRefresh: 'refresh-token',
  };

  const mockCookies = [
    { name: 'AWSALB', value: 'aws-value' },
    { name: 'PHPSESSID', value: 'session-value' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(AimharderRefreshService.login).mockResolvedValue({
      success: true,
      html: '<html>Login successful</html>',
      cookies: mockCookies,
    });

    vi.mocked(HtmlParserService.parseLoginResponse).mockResolvedValue({
      ...mockLoginResponse,
      tokenData: mockTokenData,
    });

    vi.mocked(AimharderRefreshService.refreshSession).mockResolvedValue({
      success: true,
      html: '<html>Refresh successful</html>',
      cookies: mockCookies,
      refreshToken: 'updated-refresh-token',
    });

    vi.mocked(generateBackgroundFingerprint).mockReturnValue(mockBackgroundFingerprint);
  });

  describe('Dual Login Integration', () => {
    it('should create both device and background sessions on login', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');

      const result = await AimharderAuthService.login(mockLoginRequest);

      expect(result.success).toBe(true);

      // Verify dual login: device + background
      expect(storeSessionSpy).toHaveBeenCalledTimes(2);

      // Check device session
      expect(storeSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          fingerprint: mockDeviceFingerprint,
          sessionType: 'device',
        })
      );

      // Check background session
      expect(storeSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          fingerprint: mockBackgroundFingerprint,
          sessionType: 'background',
        })
      );
    });

    it('should continue if background login fails (partial failure)', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');

      // First call (device) succeeds, second call (background) fails
      storeSessionSpy
        .mockResolvedValueOnce(undefined) // Device success
        .mockRejectedValueOnce(new Error('Background login failed')); // Background fail

      const result = await AimharderAuthService.login(mockLoginRequest);

      // Should still succeed (device session created)
      expect(result.success).toBe(true);
      expect(storeSessionSpy).toHaveBeenCalledTimes(2);
    });

    it('should call AimHarder API twice (once per session)', async () => {
      await AimharderAuthService.login(mockLoginRequest);

      // Called twice: device + background
      expect(AimharderRefreshService.login).toHaveBeenCalledTimes(2);

      // Device login with client fingerprint
      expect(AimharderRefreshService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: mockDeviceFingerprint,
        })
      );

      // Background login with server fingerprint
      expect(AimharderRefreshService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: mockBackgroundFingerprint,
        })
      );
    });

    it('should generate deterministic background fingerprint', async () => {
      await AimharderAuthService.login(mockLoginRequest);

      expect(generateBackgroundFingerprint).toHaveBeenCalledWith(mockEmail);
      expect(generateBackgroundFingerprint).toHaveBeenCalledTimes(1);
    });
  });

  describe('Re-Login Integration', () => {
    it('should update existing sessions on re-login (UPSERT)', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');

      // First login
      await AimharderAuthService.login(mockLoginRequest);

      expect(storeSessionSpy).toHaveBeenCalledTimes(2);

      // Re-login with same credentials
      await AimharderAuthService.login(mockLoginRequest);

      // Should call storeSession again (4 total: 2 + 2)
      expect(storeSessionSpy).toHaveBeenCalledTimes(4);

      // UPSERT should handle duplicate fingerprints
      // Both device sessions should have same fingerprint
      const deviceCalls = storeSessionSpy.mock.calls.filter(
        (call) => call[0].sessionType === 'device'
      );
      expect(deviceCalls).toHaveLength(2);
      expect(deviceCalls[0][0].fingerprint).toBe(deviceCalls[1][0].fingerprint);
    });
  });

  describe('Device Logout Integration', () => {
    it('should delete only device session on logout', async () => {
      const deleteSessionSpy = vi.spyOn(SupabaseSessionService, 'deleteSession');

      await AimharderAuthService.logout(mockEmail, mockDeviceFingerprint);

      expect(deleteSessionSpy).toHaveBeenCalledTimes(1);
      expect(deleteSessionSpy).toHaveBeenCalledWith(mockEmail, {
        fingerprint: mockDeviceFingerprint,
        sessionType: 'device',
      });
    });

    it('should preserve background session after device logout', async () => {
      const deleteSessionSpy = vi.spyOn(SupabaseSessionService, 'deleteSession');
      const getBackgroundSpy = vi.spyOn(SupabaseSessionService, 'getBackgroundSession');

      // Login
      await AimharderAuthService.login(mockLoginRequest);

      // Logout device
      await AimharderAuthService.logout(mockEmail, mockDeviceFingerprint);

      // Should only delete device session
      expect(deleteSessionSpy).toHaveBeenCalledWith(mockEmail, {
        fingerprint: mockDeviceFingerprint,
        sessionType: 'device',
      });

      // Background session should NOT be deleted (not called with background type)
      expect(deleteSessionSpy).not.toHaveBeenCalledWith(
        mockEmail,
        expect.objectContaining({ sessionType: 'background' })
      );
    });

    it('should delete all device sessions if no fingerprint provided', async () => {
      const deleteSessionSpy = vi.spyOn(SupabaseSessionService, 'deleteSession');

      await AimharderAuthService.logout(mockEmail); // No fingerprint

      expect(deleteSessionSpy).toHaveBeenCalledWith(mockEmail, {
        fingerprint: undefined,
        sessionType: 'device',
      });
    });

    it('should NOT call AimHarder logout API', async () => {
      const aimharderSpy = vi.fn();
      global.fetch = aimharderSpy;

      await AimharderAuthService.logout(mockEmail, mockDeviceFingerprint);

      // Should NOT call any external API
      expect(aimharderSpy).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh Integration', () => {
    it('should refresh token for specific session', async () => {
      const updateTokenSpy = vi.spyOn(SupabaseSessionService, 'updateRefreshToken');

      // This would be called by the cron job
      await SupabaseSessionService.updateRefreshToken(
        mockEmail,
        'new-refresh-token',
        mockDeviceFingerprint
      );

      expect(updateTokenSpy).toHaveBeenCalledWith(
        mockEmail,
        'new-refresh-token',
        mockDeviceFingerprint
      );
    });

    it('should refresh background session by default', async () => {
      const updateTokenSpy = vi.spyOn(SupabaseSessionService, 'updateRefreshToken');

      // No fingerprint = background session
      await SupabaseSessionService.updateRefreshToken(mockEmail, 'new-refresh-token');

      expect(updateTokenSpy).toHaveBeenCalledWith(mockEmail, 'new-refresh-token', undefined);
    });
  });

  describe('Complete User Journey', () => {
    it('should handle full user journey: login → logout → re-login', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');
      const deleteSessionSpy = vi.spyOn(SupabaseSessionService, 'deleteSession');

      // Step 1: Login (creates device + background sessions)
      await AimharderAuthService.login(mockLoginRequest);

      expect(storeSessionSpy).toHaveBeenCalledTimes(2); // device + background

      // Step 2: Logout (deletes only device session)
      await AimharderAuthService.logout(mockEmail, mockDeviceFingerprint);

      expect(deleteSessionSpy).toHaveBeenCalledTimes(1);
      expect(deleteSessionSpy).toHaveBeenCalledWith(mockEmail, {
        fingerprint: mockDeviceFingerprint,
        sessionType: 'device',
      });

      // Step 3: Re-login (updates device session, background already exists)
      await AimharderAuthService.login(mockLoginRequest);

      expect(storeSessionSpy).toHaveBeenCalledTimes(4); // 2 + 2
    });

    it('should support multiple devices for same user', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');

      const device1 = { ...mockLoginRequest, fingerprint: 'device-1' };
      const device2 = { ...mockLoginRequest, fingerprint: 'device-2' };

      // Login from device 1
      await AimharderAuthService.login(device1);

      // Login from device 2
      await AimharderAuthService.login(device2);

      expect(storeSessionSpy).toHaveBeenCalledTimes(4); // 2 devices × 2 sessions

      // Verify different device fingerprints
      const deviceCalls = storeSessionSpy.mock.calls.filter(
        (call) => call[0].sessionType === 'device'
      );

      expect(deviceCalls[0][0].fingerprint).toBe('device-1');
      expect(deviceCalls[1][0].fingerprint).toBe('device-2');

      // Background fingerprint should be the same (deterministic)
      const backgroundCalls = storeSessionSpy.mock.calls.filter(
        (call) => call[0].sessionType === 'background'
      );

      expect(backgroundCalls[0][0].fingerprint).toBe(backgroundCalls[1][0].fingerprint);
    });

    it('should preserve background session across multiple device logouts', async () => {
      const deleteSessionSpy = vi.spyOn(SupabaseSessionService, 'deleteSession');

      const device1 = { ...mockLoginRequest, fingerprint: 'device-1' };
      const device2 = { ...mockLoginRequest, fingerprint: 'device-2' };

      // Login from 2 devices
      await AimharderAuthService.login(device1);
      await AimharderAuthService.login(device2);

      // Logout device 1
      await AimharderAuthService.logout(mockEmail, 'device-1');

      // Logout device 2
      await AimharderAuthService.logout(mockEmail, 'device-2');

      // Should delete both device sessions
      expect(deleteSessionSpy).toHaveBeenCalledTimes(2);

      // Background session should never be deleted
      expect(deleteSessionSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sessionType: 'background' })
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should fail completely if device login fails', async () => {
      vi.mocked(AimharderRefreshService.login).mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials',
        cookies: [],
      });

      const result = await AimharderAuthService.login(mockLoginRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should handle database errors gracefully', async () => {
      const storeSessionSpy = vi.spyOn(SupabaseSessionService, 'storeSession');

      storeSessionSpy.mockRejectedValueOnce(new Error('Database error'));

      await expect(AimharderAuthService.login(mockLoginRequest)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
