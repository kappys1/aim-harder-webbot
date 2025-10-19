import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AimharderRefreshService } from './aimharder-refresh.service';
import { CookieService } from './cookie.service';
import type { AuthCookie, TokenUpdateRequest, RefreshRequest } from './cookie.service';

vi.mock('./cookie.service');

describe('AimharderRefreshService', () => {
  const mockToken = 'test-token-abc123';
  const mockFingerprint = 'test-fingerprint-xyz';
  const mockRefreshToken = 'refresh-token-123';

  const mockCookies: AuthCookie[] = [
    { name: 'AWSALB', value: 'aws-value' },
    { name: 'AWSALBCORS', value: 'cors-value' },
    { name: 'PHPSESSID', value: 'session-value' },
    { name: 'amhrdrauth', value: 'auth-value' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock CookieService
    vi.mocked(CookieService.formatForRequest).mockReturnValue(
      'AWSALB=aws-value; AWSALBCORS=cors-value; PHPSESSID=session-value; amhrdrauth=auth-value'
    );
    vi.mocked(CookieService.extractFromResponse).mockReturnValue(mockCookies);
  });

  describe('updateToken', () => {
    it('should successfully update token', async () => {
      const mockResponse = {
        newToken: 'new-token-456',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(true);
      expect(result.newToken).toBe('new-token-456');
      expect(result.cookies).toEqual(mockCookies);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aimharder.com/api/tokenUpdate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: expect.any(String),
          }),
        })
      );
    });

    it('should include correct form data in request body', async () => {
      const mockResponse = { newToken: 'new-token-456' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      await AimharderRefreshService.updateToken(request);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;

      expect(body).toContain(`token=${mockToken}`);
      expect(body).toContain(`fingerprint=${mockFingerprint}`);
      expect(body).toContain('ciclo=1');
    });

    it('should handle logout response', async () => {
      const mockResponse = {
        logout: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(false);
      expect(result.logout).toBe(true);
      expect(result.error).toBe('Session expired - logout required');
    });

    it('should handle missing newToken in response', async () => {
      const mockResponse = {
        // No newToken field
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No newToken in response');
    });

    it('should handle server errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should use new cookies if provided in response', async () => {
      const newCookies: AuthCookie[] = [
        { name: 'AWSALB', value: 'new-aws-value' },
        { name: 'PHPSESSID', value: 'new-session-value' },
      ];

      vi.mocked(CookieService.extractFromResponse).mockReturnValue(newCookies);

      const mockResponse = { newToken: 'new-token-456' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(true);
      expect(result.cookies).toEqual(newCookies);
    });

    it('should keep old cookies if no new ones in response', async () => {
      vi.mocked(CookieService.extractFromResponse).mockReturnValue([]);

      const mockResponse = { newToken: 'new-token-456' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: TokenUpdateRequest = {
        token: mockToken,
        fingerprint: mockFingerprint,
        cookies: mockCookies,
      };

      const result = await AimharderRefreshService.updateToken(request);

      expect(result.success).toBe(true);
      expect(result.cookies).toEqual(mockCookies);
    });
  });

  describe('refreshSession', () => {
    it('should successfully refresh session', async () => {
      const mockHtml = `
        <script>
          localStorage.setItem("refreshToken", "${mockRefreshToken}");
          localStorage.setItem("fingerprint", "${mockFingerprint}");
        </script>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(true);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.fingerprint).toBe(mockFingerprint);
    });

    it('should build correct refresh URL with provided fingerprint', async () => {
      const mockHtml = `
        <script>
          localStorage.setItem("refreshToken", "${mockRefreshToken}");
        </script>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      await AimharderRefreshService.refreshSession(request);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://aimharder.com/setrefresh'),
        expect.any(Object)
      );

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const url = fetchCall[0] as string;

      expect(url).toContain(`token=${encodeURIComponent(mockToken)}`);
      expect(url).toContain(`fingerprint=${encodeURIComponent(mockFingerprint)}`);
    });

    it('should return error when fingerprint is not provided', async () => {
      const request = {
        token: mockToken,
        cookies: mockCookies,
        // @ts-expect-error - Testing missing required field
        fingerprint: undefined,
      };

      const result = await AimharderRefreshService.refreshSession(request as RefreshRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fingerprint is required for refresh token generation');
    });

    it('should handle invalid refresh response (no script)', async () => {
      const mockHtml = '<html><body>Invalid response</body></html>';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh response');
    });

    it('should handle failed refresh token extraction', async () => {
      const mockHtml = `
        <script>
          localStorage.setItem("refreshToken", "");
          localStorage.setItem("someOtherKey", "value");
        </script>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to extract refresh token from response');
    });

    it('should handle server errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should extract only refreshToken when fingerprint is not in HTML', async () => {
      const mockHtml = `
        <script>
          localStorage.setItem("refreshToken", "${mockRefreshToken}");
        </script>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      const result = await AimharderRefreshService.refreshSession(request);

      expect(result.success).toBe(true);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.fingerprint).toBeUndefined();
    });

    it('should include cookies in request headers', async () => {
      const mockHtml = `
        <script>
          localStorage.setItem("refreshToken", "${mockRefreshToken}");
        </script>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const request: RefreshRequest = {
        token: mockToken,
        cookies: mockCookies,
        fingerprint: mockFingerprint,
      };

      await AimharderRefreshService.refreshSession(request);

      expect(CookieService.formatForRequest).toHaveBeenCalledWith(mockCookies);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Record<string, string>;

      expect(headers.Cookie).toBeDefined();
    });
  });
});
