import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxDetectionService } from './box-detection.service';
import { HtmlParserUtils } from '../../utils/html-parser.utils';
import { BoxUrlUtils } from '../../utils/url.utils';
import type { DetectedBoxInfo } from '../../models/box.model';

vi.mock('../../utils/html-parser.utils');
vi.mock('../../utils/url.utils');

// Mock global fetch
global.fetch = vi.fn();

describe('BoxDetectionService', () => {
  const mockCookies = [
    { name: 'AWSALB', value: 'test-value-1' },
    { name: 'PHPSESSID', value: 'test-session' },
  ];
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BoxUrlUtils.buildScheduleUrl).mockImplementation(
      (subdomain) => `https://${subdomain}.aimharder.com/schedule?cl`
    );
    vi.mocked(BoxUrlUtils.buildBaseUrl).mockImplementation(
      (subdomain) => `https://${subdomain}.aimharder.com`
    );
  });

  describe('detectUserBoxes', () => {
    it('should detect user boxes successfully', async () => {
      const mockHomeHtml = '<html>home page with box links</html>';
      const mockScheduleHtml = '<html>box: 10122</html>';
      const mockHomepageHtml = '<html><h1>CrossFit Box</h1></html>';

      // Mock home page fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHomeHtml),
      } as Response);

      // Mock schedule page fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockScheduleHtml),
      } as Response);

      // Mock homepage fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHomepageHtml),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue(['mybox']);
      vi.mocked(HtmlParserUtils.extractBoxId).mockReturnValue('10122');
      vi.mocked(HtmlParserUtils.extractBoxDetails).mockReturnValue({
        name: 'CrossFit Box',
        phone: '+34123456789',
        email: 'info@box.com',
      });

      const result = await BoxDetectionService.detectUserBoxes(mockToken, mockCookies);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        subdomain: 'mybox',
        boxId: '10122',
        name: 'CrossFit Box',
        phone: '+34123456789',
        email: 'info@box.com',
        address: undefined,
        website: undefined,
        logoUrl: undefined,
      });
    });

    it('should return empty array when no boxes found', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html>no boxes</html>'),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue([]);

      const result = await BoxDetectionService.detectUserBoxes(mockToken, mockCookies);

      expect(result).toEqual([]);
    });

    it('should filter out failed box detections', async () => {
      const mockHomeHtml = '<html>home page</html>';
      const mockScheduleHtml1 = '<html>box: 10122</html>';
      const mockScheduleHtml2 = '<html>no box id</html>';

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHomeHtml),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockScheduleHtml1),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>homepage</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockScheduleHtml2),
        } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue(['box1', 'box2']);
      vi.mocked(HtmlParserUtils.extractBoxId)
        .mockReturnValueOnce('10122')
        .mockReturnValueOnce(null);
      vi.mocked(HtmlParserUtils.extractBoxDetails).mockReturnValue({
        name: 'Box 1',
      });

      const result = await BoxDetectionService.detectUserBoxes(mockToken, mockCookies);

      expect(result).toHaveLength(1);
      expect(result[0].subdomain).toBe('box1');
    });

    it('should throw error when detection fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        BoxDetectionService.detectUserBoxes(mockToken, mockCookies)
      ).rejects.toThrow('Failed to detect user boxes');
    });

    it('should handle multiple boxes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>home</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>box: 10122</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>Box 1</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>box: 10123</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>Box 2</html>'),
        } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue(['box1', 'box2']);
      vi.mocked(HtmlParserUtils.extractBoxId)
        .mockReturnValueOnce('10122')
        .mockReturnValueOnce('10123');
      vi.mocked(HtmlParserUtils.extractBoxDetails)
        .mockReturnValueOnce({ name: 'Box 1' })
        .mockReturnValueOnce({ name: 'Box 2' });

      const result = await BoxDetectionService.detectUserBoxes(mockToken, mockCookies);

      expect(result).toHaveLength(2);
      expect(result[0].subdomain).toBe('box1');
      expect(result[1].subdomain).toBe('box2');
    });

    it('should use subdomain as name when name not available', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>home</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>box: 10122</html>'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html>no name</html>'),
        } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue(['mybox']);
      vi.mocked(HtmlParserUtils.extractBoxId).mockReturnValue('10122');
      vi.mocked(HtmlParserUtils.extractBoxDetails).mockReturnValue({});

      const result = await BoxDetectionService.detectUserBoxes(mockToken, mockCookies);

      expect(result[0].name).toBe('mybox');
    });
  });

  describe('fetchBoxSubdomains', () => {
    it('should fetch box subdomains from home page', async () => {
      const mockHtml = '<html>box links</html>';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxLinks).mockReturnValue(['box1', 'box2']);

      // Access private method through the class
      const result = await (BoxDetectionService as any).fetchBoxSubdomains(
        mockToken,
        mockCookies
      );

      expect(result).toEqual(['box1', 'box2']);
      expect(fetch).toHaveBeenCalledWith(
        'https://aimharder.com/home',
        expect.objectContaining({
          headers: {
            Cookie: 'AWSALB=test-value-1; PHPSESSID=test-session',
            Authorization: 'Bearer test-token-123',
          },
        })
      );
    });

    it('should throw error when fetch fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      } as Response);

      await expect(
        (BoxDetectionService as any).fetchBoxSubdomains(mockToken, mockCookies)
      ).rejects.toThrow('Failed to fetch home page: Unauthorized');
    });
  });

  describe('fetchBoxId', () => {
    it('should fetch box ID from schedule page', async () => {
      const mockHtml = '<html>box: 10122</html>';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxId).mockReturnValue('10122');

      const result = await (BoxDetectionService as any).fetchBoxId(
        'mybox',
        mockToken,
        mockCookies
      );

      expect(result).toBe('10122');
      expect(BoxUrlUtils.buildScheduleUrl).toHaveBeenCalledWith('mybox');
    });

    it('should return null when fetch fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const result = await (BoxDetectionService as any).fetchBoxId(
        'mybox',
        mockToken,
        mockCookies
      );

      expect(result).toBeNull();
    });

    it('should return null when box ID not found in HTML', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html>no box id</html>'),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxId).mockReturnValue(null);

      const result = await (BoxDetectionService as any).fetchBoxId(
        'mybox',
        mockToken,
        mockCookies
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchBoxHomepage', () => {
    it('should fetch box details from homepage', async () => {
      const mockHtml = '<html><h1>CrossFit Box</h1></html>';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response);

      vi.mocked(HtmlParserUtils.extractBoxDetails).mockReturnValue({
        name: 'CrossFit Box',
        phone: '+34123456789',
      });

      const result = await (BoxDetectionService as any).fetchBoxHomepage(
        'mybox',
        mockToken,
        mockCookies
      );

      expect(result).toEqual({
        name: 'CrossFit Box',
        phone: '+34123456789',
      });
      expect(BoxUrlUtils.buildBaseUrl).toHaveBeenCalledWith('mybox');
    });

    it('should return empty object when fetch fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const result = await (BoxDetectionService as any).fetchBoxHomepage(
        'mybox',
        mockToken,
        mockCookies
      );

      expect(result).toEqual({});
    });
  });

  describe('buildCookieHeader', () => {
    it('should build cookie header from array', () => {
      const cookies = [
        { name: 'cookie1', value: 'value1' },
        { name: 'cookie2', value: 'value2' },
      ];

      const result = (BoxDetectionService as any).buildCookieHeader(cookies);

      expect(result).toBe('cookie1=value1; cookie2=value2');
    });

    it('should handle single cookie', () => {
      const cookies = [{ name: 'single', value: 'cookie' }];

      const result = (BoxDetectionService as any).buildCookieHeader(cookies);

      expect(result).toBe('single=cookie');
    });

    it('should handle empty array', () => {
      const result = (BoxDetectionService as any).buildCookieHeader([]);

      expect(result).toBe('');
    });

    it('should handle cookies with special characters', () => {
      const cookies = [
        { name: 'cookie', value: 'value=with=equals' },
        { name: 'another', value: 'value;with;semicolon' },
      ];

      const result = (BoxDetectionService as any).buildCookieHeader(cookies);

      expect(result).toBe('cookie=value=with=equals; another=value;with;semicolon');
    });
  });
});
