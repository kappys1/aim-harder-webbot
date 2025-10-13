import { describe, it, expect } from 'vitest';
import { HtmlParserUtils } from './html-parser.utils';

describe('HtmlParserUtils', () => {
  describe('extractBoxId', () => {
    it('should extract box ID from HTML', () => {
      const html = '<script>var box: 10122</script>';
      const result = HtmlParserUtils.extractBoxId(html);

      expect(result).toBe('10122');
    });

    it('should extract box ID with spaces', () => {
      const html = 'box:   12345';
      const result = HtmlParserUtils.extractBoxId(html);

      expect(result).toBe('12345');
    });

    it('should return null when no box ID found', () => {
      const html = '<div>No box ID here</div>';
      const result = HtmlParserUtils.extractBoxId(html);

      expect(result).toBeNull();
    });

    it('should extract first box ID when multiple exist', () => {
      const html = 'box: 111 and box: 222';
      const result = HtmlParserUtils.extractBoxId(html);

      expect(result).toBe('111');
    });

    it('should handle empty string', () => {
      const result = HtmlParserUtils.extractBoxId('');

      expect(result).toBeNull();
    });
  });

  describe('extractSubdomain', () => {
    it('should extract subdomain from URL', () => {
      const url = 'https://crossfitcerdanyola300.aimharder.com';
      const result = HtmlParserUtils.extractSubdomain(url);

      expect(result).toBe('crossfitcerdanyola300');
    });

    it('should extract subdomain from URL with path', () => {
      const url = 'https://mybox.aimharder.com/schedule?cl';
      const result = HtmlParserUtils.extractSubdomain(url);

      expect(result).toBe('mybox');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com';
      const result = HtmlParserUtils.extractSubdomain(url);

      expect(result).toBeNull();
    });

    it('should return null for URL without subdomain', () => {
      const url = 'https://aimharder.com';
      const result = HtmlParserUtils.extractSubdomain(url);

      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = HtmlParserUtils.extractSubdomain('');

      expect(result).toBeNull();
    });
  });

  describe('extractBoxLinks', () => {
    it('should extract box links from HTML', () => {
      const html = `
        <a href="https://box1.aimharder.com">Box 1</a>
        <a href="https://box2.aimharder.com">Box 2</a>
        <a href="https://box3.aimharder.com">Box 3</a>
      `;
      const result = HtmlParserUtils.extractBoxLinks(html);

      expect(result).toEqual(['box1', 'box2', 'box3']);
    });

    it('should remove duplicate subdomains', () => {
      const html = `
        <a href="https://box1.aimharder.com">Box 1</a>
        <a href="https://box1.aimharder.com/home">Box 1 Home</a>
        <a href="https://box2.aimharder.com">Box 2</a>
      `;
      const result = HtmlParserUtils.extractBoxLinks(html);

      expect(result).toEqual(['box1', 'box2']);
    });

    it('should exclude www subdomain', () => {
      const html = `
        <a href="https://www.aimharder.com">Main</a>
        <a href="https://box1.aimharder.com">Box 1</a>
      `;
      const result = HtmlParserUtils.extractBoxLinks(html);

      expect(result).toEqual(['box1']);
    });

    it('should return empty array when no links found', () => {
      const html = '<div>No links here</div>';
      const result = HtmlParserUtils.extractBoxLinks(html);

      expect(result).toEqual([]);
    });

    it('should handle empty string', () => {
      const result = HtmlParserUtils.extractBoxLinks('');

      expect(result).toEqual([]);
    });

    it('should handle mixed content with other URLs', () => {
      const html = `
        <a href="https://box1.aimharder.com">Box 1</a>
        <a href="https://google.com">Google</a>
        <a href="https://box2.aimharder.com">Box 2</a>
      `;
      const result = HtmlParserUtils.extractBoxLinks(html);

      expect(result).toEqual(['box1', 'box2']);
    });
  });

  describe('extractBoxDetails', () => {
    it('should extract all box details from HTML', () => {
      const html = `
        <html>
          <body>
            <h1>CrossFit Cerdanyola</h1>
            <a href="tel:+34123456789">Call us</a>
            <a href="mailto:info@crossfit.com">Email us</a>
            <div class="address">123 Main St, Barcelona</div>
            <a href="https://crossfit-external.com">Visit website</a>
            <img class="logo" src="/images/logo.png" />
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'crossfitcerdanyola');

      expect(result.name).toBe('CrossFit Cerdanyola');
      expect(result.phone).toBe('+34123456789');
      expect(result.email).toBe('info@crossfit.com');
      expect(result.address).toBe('123 Main St, Barcelona');
      expect(result.website).toBe('https://crossfit-external.com');
      expect(result.logoUrl).toBe('https://crossfitcerdanyola.aimharder.com/images/logo.png');
    });

    it('should extract box name from first available selector', () => {
      const html = `
        <html>
          <body>
            <div class="box-name">Box Name from class</div>
            <h1>Box Name from h1</h1>
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.name).toBe('Box Name from class');
    });

    it('should fallback to h1 when box-name not found', () => {
      const html = `
        <html>
          <body>
            <h1>Box Name from h1</h1>
            <div class="title">Box Name from title</div>
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.name).toBe('Box Name from h1');
    });

    it('should handle missing phone', () => {
      const html = '<html><body><h1>Box</h1></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.phone).toBeUndefined();
    });

    it('should handle missing email', () => {
      const html = '<html><body><h1>Box</h1></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.email).toBeUndefined();
    });

    it('should extract address from first available selector', () => {
      const html = `
        <html>
          <body>
            <div class="address">Address from .address</div>
            <div class="location">Address from .location</div>
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.address).toBe('Address from .address');
    });

    it('should handle missing address', () => {
      const html = '<html><body><h1>Box</h1></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.address).toBeUndefined();
    });

    it('should exclude aimharder.com links from website', () => {
      const html = `
        <html>
          <body>
            <h1>Box</h1>
            <a href="https://mybox.aimharder.com/home">Internal</a>
            <a href="https://external-website.com">External</a>
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.website).toBe('https://external-website.com');
    });

    it('should handle missing website', () => {
      const html = '<html><body><h1>Box</h1></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.website).toBeUndefined();
    });

    it('should convert relative logo URL to absolute', () => {
      const html = '<html><body><img class="logo" src="/images/logo.png" /></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.logoUrl).toBe('https://mybox.aimharder.com/images/logo.png');
    });

    it('should convert relative logo URL without leading slash', () => {
      const html = '<html><body><img class="logo" src="images/logo.png" /></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.logoUrl).toBe('https://mybox.aimharder.com/images/logo.png');
    });

    it('should keep absolute logo URL unchanged', () => {
      const html = '<html><body><img class="logo" src="https://cdn.example.com/logo.png" /></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
    });

    it('should handle missing logo', () => {
      const html = '<html><body><h1>Box</h1></body></html>';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.logoUrl).toBeUndefined();
    });

    it('should trim whitespace from extracted values', () => {
      const html = `
        <html>
          <body>
            <h1>  Box Name  </h1>
            <a href="tel:  +34123456789  ">Call</a>
            <a href="mailto:  info@box.com  ">Email</a>
            <div class="address">  123 Main St  </div>
          </body>
        </html>
      `;

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result.name).toBe('Box Name');
      expect(result.phone).toBe('+34123456789');
      expect(result.email).toBe('info@box.com');
      expect(result.address).toBe('123 Main St');
    });

    it('should handle empty HTML', () => {
      const result = HtmlParserUtils.extractBoxDetails('', 'mybox');

      expect(result).toEqual({
        name: undefined,
        phone: undefined,
        email: undefined,
        address: undefined,
        website: undefined,
        logoUrl: undefined,
      });
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<div>Incomplete HTML';

      const result = HtmlParserUtils.extractBoxDetails(html, 'mybox');

      expect(result).toBeDefined();
    });
  });
});
