import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cookies
    if (typeof document !== 'undefined') {
      document.cookie = '';
    }
  });

  describe('login', () => {
    it('should call /api/auth/aimharder with correct payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 'test@example.com',
              email: 'test@example.com',
              name: 'Test User',
            },
            token: 'test-token',
          },
        }),
      });
      global.fetch = mockFetch;

      const request = {
        email: 'test@example.com',
        password: 'password123',
        fingerprint: 'test-fingerprint',
      };

      await authService.login(request);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/aimharder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email,
          password: request.password,
          fingerprint: request.fingerprint,
        }),
      });
    });

    it('should return success response on successful login', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'test@example.com',
            email: 'test@example.com',
            name: 'Test User',
          },
          token: 'test-token',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(result.token).toBe('test-token');
    });

    it('should handle rate limiting (429) error', async () => {
      const mockResponse = {
        success: false,
        error: 'Too many attempts',
        rateLimited: true,
        minutesRemaining: 15,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => mockResponse,
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many attempts');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Invalid credentials',
        }),
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should be a no-op (soft logout)', async () => {
      // Logout doesn't do anything anymore (soft logout)
      await expect(authService.logout('test@example.com')).resolves.toBeUndefined();
    });
  });

  describe('checkSession', () => {
    it('should check session validity via API', async () => {
      const mockResponse = {
        success: true,
        sessionValid: true,
        data: {
          user: {
            id: 'test@example.com',
            email: 'test@example.com',
            name: 'Test User',
          },
          token: 'test-token',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.checkSession('test@example.com');

      expect(result.isValid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.token).toBe('test-token');
    });

    it('should return invalid for expired session', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          sessionValid: false,
        }),
      });

      const result = await authService.checkSession('test@example.com');

      expect(result.isValid).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await authService.checkSession('test@example.com');

      expect(result.isValid).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when auth cookie exists', async () => {
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'aimharder-auth=true',
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when auth cookie does not exist', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false when auth cookie is false', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'aimharder-auth=false',
      });

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getCookieValue', () => {
    it('should extract cookie value by name', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'cookie1=value1; cookie2=value2; cookie3=value3',
      });

      const result = authService.getCookieValue('cookie2');

      expect(result).toBe('value2');
    });

    it('should return null for non-existent cookie', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'cookie1=value1',
      });

      const result = authService.getCookieValue('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null in server environment', () => {
      // Temporarily remove document
      const originalDocument = global.document;
      // @ts-expect-error - testing server environment
      delete global.document;

      const result = authService.getCookieValue('test');

      expect(result).toBeNull();

      // Restore document
      global.document = originalDocument;
    });
  });

  describe('getAimharderCookies', () => {
    it('should extract all required aimharder cookies', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'AWSALB=alb123; AWSALBCORS=cors456; PHPSESSID=php789; amhrdrauth=auth000; other=ignore',
      });

      const result = authService.getAimharderCookies();

      expect(result).toEqual({
        AWSALB: 'alb123',
        AWSALBCORS: 'cors456',
        PHPSESSID: 'php789',
        amhrdrauth: 'auth000',
      });
    });

    it('should return empty object when no cookies exist', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      const result = authService.getAimharderCookies();

      expect(result).toEqual({});
    });

    it('should only include cookies that exist', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'AWSALB=alb123; PHPSESSID=php789',
      });

      const result = authService.getAimharderCookies();

      expect(result).toEqual({
        AWSALB: 'alb123',
        PHPSESSID: 'php789',
      });
      expect(result.AWSALBCORS).toBeUndefined();
      expect(result.amhrdrauth).toBeUndefined();
    });
  });
});
