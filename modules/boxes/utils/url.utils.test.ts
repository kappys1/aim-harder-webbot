import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoxUrlUtils } from './url.utils';

describe('BoxUrlUtils', () => {
  // Mock window.location for tests that use it
  const mockLocation = {
    origin: 'http://localhost:3000',
  };

  beforeEach(() => {
    // @ts-ignore
    global.window = { location: mockLocation };
  });

  describe('buildBaseUrl', () => {
    it('should build base URL for a subdomain', () => {
      const result = BoxUrlUtils.buildBaseUrl('crossfitcerdanyola');

      expect(result).toBe('https://crossfitcerdanyola.aimharder.com');
    });

    it('should handle subdomain with numbers', () => {
      const result = BoxUrlUtils.buildBaseUrl('crossfit123');

      expect(result).toBe('https://crossfit123.aimharder.com');
    });

    it('should handle subdomain with hyphens', () => {
      const result = BoxUrlUtils.buildBaseUrl('crossfit-barcelona');

      expect(result).toBe('https://crossfit-barcelona.aimharder.com');
    });

    it('should handle empty subdomain', () => {
      const result = BoxUrlUtils.buildBaseUrl('');

      expect(result).toBe('https://.aimharder.com');
    });
  });

  describe('buildScheduleUrl', () => {
    it('should build schedule URL for a subdomain', () => {
      const result = BoxUrlUtils.buildScheduleUrl('crossfitcerdanyola');

      expect(result).toBe('https://crossfitcerdanyola.aimharder.com/schedule?cl');
    });

    it('should include query parameter', () => {
      const result = BoxUrlUtils.buildScheduleUrl('mybox');

      expect(result).toContain('?cl');
    });

    it('should handle subdomain with special characters', () => {
      const result = BoxUrlUtils.buildScheduleUrl('box-123');

      expect(result).toBe('https://box-123.aimharder.com/schedule?cl');
    });
  });

  describe('buildUrlWithBoxId', () => {
    it('should add boxId to path', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/booking', 'box-123');

      expect(result).toBe('http://localhost:3000/booking?boxId=box-123');
    });

    it('should preserve existing query parameters', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/booking?date=2025-01-15', 'box-123');

      expect(result).toContain('date=2025-01-15');
      expect(result).toContain('boxId=box-123');
    });

    it('should override existing boxId parameter', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/booking?boxId=old-box', 'new-box');

      expect(result).toBe('http://localhost:3000/booking?boxId=new-box');
      expect(result).not.toContain('old-box');
    });

    it('should handle root path', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/', 'box-123');

      expect(result).toBe('http://localhost:3000/?boxId=box-123');
    });

    it('should handle path with hash', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/booking#section', 'box-123');

      expect(result).toContain('boxId=box-123');
      expect(result).toContain('#section');
    });

    it('should encode special characters in boxId', () => {
      const result = BoxUrlUtils.buildUrlWithBoxId('/booking', 'box&special');

      expect(result).toContain('box%26special');
    });
  });

  describe('extractBoxIdFromUrl', () => {
    it('should extract boxId from search params', () => {
      const searchParams = new URLSearchParams('?boxId=box-123');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBe('box-123');
    });

    it('should return null when boxId not present', () => {
      const searchParams = new URLSearchParams('?date=2025-01-15');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBeNull();
    });

    it('should return null for empty search params', () => {
      const searchParams = new URLSearchParams('');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBeNull();
    });

    it('should handle boxId with special characters', () => {
      const searchParams = new URLSearchParams('?boxId=box-123-test');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBe('box-123-test');
    });

    it('should handle multiple parameters', () => {
      const searchParams = new URLSearchParams('?date=2025-01-15&boxId=box-123&other=value');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBe('box-123');
    });

    it('should return first boxId if multiple exist', () => {
      const searchParams = new URLSearchParams('?boxId=box-1&boxId=box-2');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBe('box-1');
    });

    it('should decode URL-encoded boxId', () => {
      const searchParams = new URLSearchParams('?boxId=box%20123');
      const result = BoxUrlUtils.extractBoxIdFromUrl(searchParams);

      expect(result).toBe('box 123');
    });
  });

  describe('navigateWithBoxId', () => {
    it('should navigate to path with boxId', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking', 'box-123');

      expect(mockRouter.push).toHaveBeenCalledWith('/booking?boxId=box-123');
    });

    it('should preserve existing query parameters', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking?date=2025-01-15', 'box-123');

      expect(mockRouter.push).toHaveBeenCalledWith('/booking?date=2025-01-15&boxId=box-123');
    });

    it('should override existing boxId parameter', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking?boxId=old-box', 'new-box');

      const callArg = mockRouter.push.mock.calls[0][0];
      expect(callArg).toContain('boxId=new-box');
      expect(callArg).not.toContain('old-box');
    });

    it('should handle root path', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/', 'box-123');

      expect(mockRouter.push).toHaveBeenCalledWith('/?boxId=box-123');
    });

    it('should not include hash in navigation', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking#section', 'box-123');

      const callArg = mockRouter.push.mock.calls[0][0];
      expect(callArg).not.toContain('#section');
      expect(callArg).toContain('boxId=box-123');
    });

    it('should encode special characters in boxId', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking', 'box&special');

      const callArg = mockRouter.push.mock.calls[0][0];
      expect(callArg).toContain('box%26special');
    });

    it('should handle path with trailing slash', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking/', 'box-123');

      expect(mockRouter.push).toHaveBeenCalledWith('/booking/?boxId=box-123');
    });

    it('should call router.push exactly once', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking', 'box-123');

      expect(mockRouter.push).toHaveBeenCalledTimes(1);
    });

    it('should handle complex query strings', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(
        mockRouter,
        '/booking?date=2025-01-15&time=10:00&type=class',
        'box-123'
      );

      const callArg = mockRouter.push.mock.calls[0][0];
      expect(callArg).toContain('date=2025-01-15');
      expect(callArg).toContain('time=10%3A00');
      expect(callArg).toContain('type=class');
      expect(callArg).toContain('boxId=box-123');
    });

    it('should handle empty boxId', () => {
      const mockRouter = {
        push: vi.fn(),
      };

      BoxUrlUtils.navigateWithBoxId(mockRouter, '/booking', '');

      expect(mockRouter.push).toHaveBeenCalledWith('/booking?boxId=');
    });
  });
});
