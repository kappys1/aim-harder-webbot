import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AimharderAuthService } from './aimharder-auth.service';
import { CookieService } from './cookie.service';
import { HtmlParserService } from './html-parser.service';
import { SupabaseSessionService } from './supabase-session.service';
import { AimharderRefreshService } from './aimharder-refresh.service';
import type { AuthCookie } from './cookie.service';

vi.mock('./cookie.service');
vi.mock('./html-parser.service');
vi.mock('./supabase-session.service');
vi.mock('./aimharder-refresh.service');

describe('AimharderAuthService', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockFingerprint = 'test-fingerprint-123';
  const mockToken = 'test-token-abc';

  const mockCookies: AuthCookie[] = [
    { name: 'AWSALB', value: 'aws-value' },
    { name: 'AWSALBCORS', value: 'cors-value' },
    { name: 'PHPSESSID', value: 'session-value' },
    { name: 'amhrdrauth', value: 'auth-value' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default environment
    process.env.AIMHARDER_LOGIN_URL = 'https://aimharder.com/login';
    process.env.AIMHARDER_FINGERPRINT = 'default-fingerprint';

    // Mock CookieService
    vi.mocked(CookieService.extractFromResponse).mockReturnValue(mockCookies);
    vi.mocked(CookieService.validateRequiredCookies).mockReturnValue({
      isValid: true,
      missing: [],
    });

    // Mock HtmlParserService
    vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
      isValid: true,
    });
    vi.mocked(HtmlParserService.extractTokenFromIframe).mockReturnValue({
      token: mockToken,
      tokenType: 'bearer',
      expiresIn: 3600,
    });

    // Mock SupabaseSessionService
    vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(null);
    vi.mocked(SupabaseSessionService.storeSession).mockResolvedValue();
    vi.mocked(SupabaseSessionService.updateRefreshToken).mockResolvedValue();
    vi.mocked(SupabaseSessionService.deleteSession).mockResolvedValue();
    vi.mocked(SupabaseSessionService.isSessionValid).mockResolvedValue(true);

    // Mock AimharderRefreshService
    vi.mocked(AimharderRefreshService.refreshSession).mockResolvedValue({
      success: true,
      refreshToken: 'refresh-token-123',
      fingerprint: mockFingerprint,
    });
  });

  afterEach(() => {
    // Clear rate limit attempts after each test
    vi.clearAllMocks();
    // Reset the private attempts Map by calling logout for test email
    // This ensures clean state between tests
    try {
      (AimharderAuthService as any).attempts.clear();
    } catch (e) {
      // Ignore if attempts is not accessible
    }
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      const result = await AimharderAuthService.login(mockEmail, mockPassword, mockFingerprint);

      expect(result.success).toBe(true);
      expect(result.data?.user.email).toBe(mockEmail);
      expect(result.data?.token).toBe(mockToken);
      expect(result.cookies).toEqual(mockCookies);

      expect(global.fetch).toHaveBeenCalledWith(
        process.env.AIMHARDER_LOGIN_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should use provided fingerprint over environment variable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      await AimharderAuthService.login(mockEmail, mockPassword, mockFingerprint);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;

      expect(body).toContain(`loginfingerprint=${mockFingerprint}`);
    });

    it('should fallback to environment fingerprint when not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      await AimharderAuthService.login(mockEmail, mockPassword);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;

      expect(body).toContain(`loginfingerprint=${process.env.AIMHARDER_FINGERPRINT}`);
    });

    it('should handle invalid credentials (HTML validation failed)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Error response</html>',
      } as Response);

      vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
        isValid: false,
        errorMessage: 'Invalid email or password',
      });

      const result = await AimharderAuthService.login(mockEmail, 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should handle failed token extraction', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      vi.mocked(HtmlParserService.extractTokenFromIframe).mockReturnValue(null);

      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to extract authentication token');
    });

    it('should handle server errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should store session in Supabase after successful login', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      await AimharderAuthService.login(mockEmail, mockPassword, mockFingerprint);

      expect(SupabaseSessionService.storeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          token: mockToken,
          cookies: mockCookies,
        })
      );
    });

    it('should call refresh service and update refresh token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      await AimharderAuthService.login(mockEmail, mockPassword, mockFingerprint);

      expect(AimharderRefreshService.refreshSession).toHaveBeenCalledWith({
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      });

      expect(SupabaseSessionService.updateRefreshToken).toHaveBeenCalledWith(
        mockEmail,
        'refresh-token-123',
        mockFingerprint
      );
    });

    it('should continue login even if refresh service fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      vi.mocked(AimharderRefreshService.refreshSession).mockResolvedValue({
        success: false,
        error: 'Refresh failed',
      });

      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(true);
      expect(result.data?.token).toBe(mockToken);
    });

    it('should warn about missing cookies but continue login', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      vi.mocked(CookieService.validateRequiredCookies).mockReturnValue({
        isValid: false,
        missing: ['PHPSESSID'],
      });

      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Missing required cookies:',
        ['PHPSESSID']
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('should delete session from Supabase', async () => {
      await AimharderAuthService.logout(mockEmail);

      expect(SupabaseSessionService.deleteSession).toHaveBeenCalledWith(mockEmail);
    });

    it('should throw error if deletion fails', async () => {
      vi.mocked(SupabaseSessionService.deleteSession).mockRejectedValue(
        new Error('Database error')
      );

      await expect(AimharderAuthService.logout(mockEmail)).rejects.toThrow('Database error');
    });
  });

  describe('refreshSession', () => {
    it('should return existing valid session', async () => {
      const mockSession = {
        email: mockEmail,
        token: mockToken,
        cookies: mockCookies,
        tokenData: { token: mockToken, tokenType: 'bearer', expiresIn: 3600 },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession);
      vi.mocked(SupabaseSessionService.isSessionValid).mockResolvedValue(true);

      const result = await AimharderAuthService.refreshSession(mockEmail);

      expect(result.success).toBe(true);
      expect(result.data?.token).toBe(mockToken);
      expect(result.cookies).toEqual(mockCookies);
    });

    it('should return error if no session found', async () => {
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(null);

      const result = await AimharderAuthService.refreshSession(mockEmail);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No session found');
    });

    it('should delete expired session', async () => {
      const mockSession = {
        email: mockEmail,
        token: mockToken,
        cookies: mockCookies,
        tokenData: { token: mockToken, tokenType: 'bearer', expiresIn: 3600 },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession);
      vi.mocked(SupabaseSessionService.isSessionValid).mockResolvedValue(false);

      const result = await AimharderAuthService.refreshSession(mockEmail);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired');
      expect(SupabaseSessionService.deleteSession).toHaveBeenCalledWith(mockEmail);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(SupabaseSessionService.getSession).mockRejectedValue(
        new Error('Database error')
      );

      const result = await AimharderAuthService.refreshSession(mockEmail);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh session');
    });
  });

  describe('getStoredSession', () => {
    it('should return stored session', async () => {
      const mockSession = {
        email: mockEmail,
        token: mockToken,
        cookies: mockCookies,
        tokenData: { token: mockToken, tokenType: 'bearer', expiresIn: 3600 },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(mockSession);

      const result = await AimharderAuthService.getStoredSession(mockEmail);

      expect(result).toEqual(mockSession);
    });

    it('should return null if no session found', async () => {
      vi.mocked(SupabaseSessionService.getSession).mockResolvedValue(null);

      const result = await AimharderAuthService.getStoredSession(mockEmail);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      vi.mocked(SupabaseSessionService.getSession).mockRejectedValue(
        new Error('Database error')
      );

      const result = await AimharderAuthService.getStoredSession(mockEmail);

      expect(result).toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('should allow login within rate limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
          isValid: false,
          errorMessage: 'Invalid credentials',
        });
        await AimharderAuthService.login(mockEmail, 'wrongpassword');
      }

      // 5th attempt should still be allowed
      vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
        isValid: true,
      });
      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(true);
    });

    it('should block login after max failed attempts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
          isValid: false,
          errorMessage: 'Invalid credentials',
        });
        await AimharderAuthService.login(mockEmail, 'wrongpassword');
      }

      // 6th attempt should be blocked
      const result = await AimharderAuthService.login(mockEmail, mockPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many login attempts');
    });

    it('should return remaining attempts correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      const initialRemaining = AimharderAuthService.getRemainingAttempts(mockEmail);
      expect(initialRemaining).toBe(5);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
          isValid: false,
          errorMessage: 'Invalid credentials',
        });
        await AimharderAuthService.login(mockEmail, 'wrongpassword');
      }

      const remaining = AimharderAuthService.getRemainingAttempts(mockEmail);
      expect(remaining).toBe(2);
    });

    it('should return time until next attempt when rate limited', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
          isValid: false,
          errorMessage: 'Invalid credentials',
        });
        await AimharderAuthService.login(mockEmail, 'wrongpassword');
      }

      const timeUntilNext = AimharderAuthService.getTimeUntilNextAttempt(mockEmail);
      expect(timeUntilNext).toBeGreaterThan(0);
    });

    it('should clear attempts after successful logout', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html>Valid response</html>',
      } as Response);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        vi.mocked(HtmlParserService.validateHtmlResponse).mockReturnValue({
          isValid: false,
          errorMessage: 'Invalid credentials',
        });
        await AimharderAuthService.login(mockEmail, 'wrongpassword');
      }

      expect(AimharderAuthService.getRemainingAttempts(mockEmail)).toBe(2);

      await AimharderAuthService.logout(mockEmail);

      expect(AimharderAuthService.getRemainingAttempts(mockEmail)).toBe(5);
    });
  });
});
