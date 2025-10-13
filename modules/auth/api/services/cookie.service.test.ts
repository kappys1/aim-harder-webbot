import { describe, it, expect, vi } from 'vitest';
import { CookieService } from './cookie.service';
import type { AuthCookie } from './cookie.service';

describe('CookieService', () => {
  const mockCookies: AuthCookie[] = [
    { name: 'AWSALB', value: 'aws-value-123' },
    { name: 'AWSALBCORS', value: 'cors-value-456' },
    { name: 'PHPSESSID', value: 'php-session-789' },
    { name: 'amhrdrauth', value: 'auth-token-abc' },
  ];

  describe('extractFromResponse', () => {
    it('should extract cookies from getSetCookie() method', () => {
      const mockResponse = {
        headers: {
          getSetCookie: () => [
            'AWSALB=aws-value-123; Path=/; HttpOnly',
            'PHPSESSID=php-session-789; Path=/; Secure',
          ],
          get: vi.fn(),
        },
      } as unknown as Response;

      const result = CookieService.extractFromResponse(mockResponse);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'AWSALB', value: 'aws-value-123' });
      expect(result[1]).toEqual({ name: 'PHPSESSID', value: 'php-session-789' });
    });

    it('should fallback to get("set-cookie") when getSetCookie is not available', () => {
      const mockResponse = {
        headers: {
          getSetCookie: undefined,
          get: (key: string) => {
            if (key === 'set-cookie') {
              return 'AWSALB=aws-value-123; Path=/';
            }
            return null;
          },
        },
      } as unknown as Response;

      const result = CookieService.extractFromResponse(mockResponse);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'AWSALB', value: 'aws-value-123' });
    });

    it('should filter only required cookies', () => {
      const mockResponse = {
        headers: {
          getSetCookie: () => [
            'AWSALB=aws-value-123',
            'random-cookie=random-value',
            'PHPSESSID=php-session-789',
          ],
        },
      } as unknown as Response;

      const result = CookieService.extractFromResponse(mockResponse);

      expect(result).toHaveLength(2);
      expect(result.find(c => c.name === 'random-cookie')).toBeUndefined();
    });

    it('should return empty array when no cookies present', () => {
      const mockResponse = {
        headers: {
          getSetCookie: () => [],
          get: () => null,
        },
      } as unknown as Response;

      const result = CookieService.extractFromResponse(mockResponse);

      expect(result).toEqual([]);
    });

    it('should handle cookies with equals sign in value', () => {
      const mockResponse = {
        headers: {
          getSetCookie: () => ['AWSALB=base64==value; Path=/'],
        },
      } as unknown as Response;

      const result = CookieService.extractFromResponse(mockResponse);

      expect(result[0]).toEqual({ name: 'AWSALB', value: 'base64==value' });
    });
  });

  describe('formatForRequest', () => {
    it('should format cookies for Cookie header', () => {
      const result = CookieService.formatForRequest(mockCookies);

      expect(result).toBe(
        'AWSALB=aws-value-123; AWSALBCORS=cors-value-456; PHPSESSID=php-session-789; amhrdrauth=auth-token-abc'
      );
    });

    it('should handle empty array', () => {
      const result = CookieService.formatForRequest([]);

      expect(result).toBe('');
    });

    it('should handle single cookie', () => {
      const result = CookieService.formatForRequest([
        { name: 'AWSALB', value: 'test-value' },
      ]);

      expect(result).toBe('AWSALB=test-value');
    });
  });

  describe('serializeForResponse', () => {
    it('should serialize cookie with default options', () => {
      const result = CookieService.serializeForResponse('session', 'abc123');

      expect(result).toContain('session=abc123');
      expect(result).toContain('HttpOnly');
      expect(result).toContain('Path=/');
      expect(result).toContain('SameSite=Lax');
    });

    it('should serialize with custom options', () => {
      const result = CookieService.serializeForResponse('session', 'abc123', {
        httpOnly: false,
        maxAge: 3600,
        sameSite: 'strict',
      });

      expect(result).toContain('session=abc123');
      expect(result).toContain('Max-Age=3600');
      expect(result).toContain('SameSite=Strict');
    });

    it('should include secure flag in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = CookieService.serializeForResponse('session', 'abc123');

      expect(result).toContain('Secure');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('parseFromRequest', () => {
    it('should parse cookies from Cookie header', () => {
      const cookieHeader =
        'AWSALB=aws-value-123; PHPSESSID=php-session-789; random=value';

      const result = CookieService.parseFromRequest(cookieHeader);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'AWSALB', value: 'aws-value-123' });
      expect(result[1]).toEqual({ name: 'PHPSESSID', value: 'php-session-789' });
      expect(result.find(c => c.name === 'random')).toBeUndefined();
    });

    it('should return empty array for empty header', () => {
      const result = CookieService.parseFromRequest('');

      expect(result).toEqual([]);
    });

    it('should filter only required cookies', () => {
      const cookieHeader = 'AWSALB=value1; other=value2; PHPSESSID=value3';

      const result = CookieService.parseFromRequest(cookieHeader);

      expect(result).toHaveLength(2);
      expect(result.map(c => c.name)).toEqual(['AWSALB', 'PHPSESSID']);
    });
  });

  describe('validateRequiredCookies', () => {
    it('should return valid when all required cookies present', () => {
      const result = CookieService.validateRequiredCookies(mockCookies);

      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return invalid with missing cookies list', () => {
      const incompleteCookies: AuthCookie[] = [
        { name: 'AWSALB', value: 'value1' },
        { name: 'PHPSESSID', value: 'value2' },
      ];

      const result = CookieService.validateRequiredCookies(incompleteCookies);

      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['AWSALBCORS', 'amhrdrauth']);
    });

    it('should return invalid for empty array', () => {
      const result = CookieService.validateRequiredCookies([]);

      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual([
        'AWSALB',
        'AWSALBCORS',
        'PHPSESSID',
        'amhrdrauth',
      ]);
    });
  });

  describe('getCookieByName', () => {
    it('should find cookie by name', () => {
      const result = CookieService.getCookieByName(mockCookies, 'PHPSESSID');

      expect(result).toEqual({ name: 'PHPSESSID', value: 'php-session-789' });
    });

    it('should return undefined for non-existent cookie', () => {
      const result = CookieService.getCookieByName(mockCookies, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = CookieService.getCookieByName([], 'AWSALB');

      expect(result).toBeUndefined();
    });
  });

  describe('mergeCookies', () => {
    it('should merge new cookies with existing ones', () => {
      const existing: AuthCookie[] = [
        { name: 'AWSALB', value: 'old-value' },
        { name: 'PHPSESSID', value: 'session-123' },
      ];

      const newCookies: AuthCookie[] = [
        { name: 'AWSALB', value: 'new-value' },
        { name: 'amhrdrauth', value: 'auth-token' },
      ];

      const result = CookieService.mergeCookies(existing, newCookies);

      expect(result).toHaveLength(3);
      expect(result.find(c => c.name === 'AWSALB')?.value).toBe('new-value');
      expect(result.find(c => c.name === 'PHPSESSID')?.value).toBe('session-123');
      expect(result.find(c => c.name === 'amhrdrauth')?.value).toBe('auth-token');
    });

    it('should add cookies that do not exist', () => {
      const existing: AuthCookie[] = [{ name: 'AWSALB', value: 'value1' }];
      const newCookies: AuthCookie[] = [{ name: 'PHPSESSID', value: 'value2' }];

      const result = CookieService.mergeCookies(existing, newCookies);

      expect(result).toHaveLength(2);
    });

    it('should handle empty existing array', () => {
      const newCookies: AuthCookie[] = [{ name: 'AWSALB', value: 'value1' }];

      const result = CookieService.mergeCookies([], newCookies);

      expect(result).toEqual(newCookies);
    });

    it('should handle empty new cookies array', () => {
      const existing: AuthCookie[] = [{ name: 'AWSALB', value: 'value1' }];

      const result = CookieService.mergeCookies(existing, []);

      expect(result).toEqual(existing);
    });

    it('should not mutate original arrays', () => {
      const existing: AuthCookie[] = [{ name: 'AWSALB', value: 'old' }];
      const newCookies: AuthCookie[] = [{ name: 'AWSALB', value: 'new' }];
      const originalExisting = [...existing];

      CookieService.mergeCookies(existing, newCookies);

      expect(existing).toEqual(originalExisting);
    });
  });
});
