import { describe, it, expect } from 'vitest';
import { HtmlParserService } from './html-parser.service';

describe('HtmlParserService', () => {
  describe('extractTokenFromIframe', () => {
    it('should extract token from iframe src with absolute URL', () => {
      const html = `
        <html>
          <body>
            <iframe src="https://aimharder.com/setrefresh?token=abc123&fingerprint=xyz789"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toEqual({
        token: 'abc123',
        fingerprint: 'xyz789',
        user: undefined,
        refresh: undefined,
      });
    });

    it('should extract token from iframe src with relative URL', () => {
      const html = `
        <html>
          <body>
            <iframe src="/setrefresh?token=test-token-456"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toEqual({
        token: 'test-token-456',
        fingerprint: undefined,
        user: undefined,
        refresh: undefined,
      });
    });

    it('should extract all parameters when available', () => {
      const html = `
        <html>
          <body>
            <iframe src="/setrefresh?token=token123&fingerprint=fp123&user=user1&refresh=ref456"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toEqual({
        token: 'token123',
        fingerprint: 'fp123',
        user: 'user1',
        refresh: 'ref456',
      });
    });

    it('should return null when no iframe found', () => {
      const html = `
        <html>
          <body>
            <p>No iframe here</p>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toBeNull();
    });

    it('should return null when iframe has no src', () => {
      const html = `
        <html>
          <body>
            <iframe></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toBeNull();
    });

    it('should return null when no token in iframe src', () => {
      const html = `
        <html>
          <body>
            <iframe src="/some-page?other=param"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractTokenFromIframe(html);

      expect(result).toBeNull();
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<invalid html content';

      const result = HtmlParserService.extractTokenFromIframe(html);

      // Should not throw, just return null
      expect(result).toBeNull();
    });
  });

  describe('extractRedirectUrl', () => {
    it('should extract URL from window.location.href', () => {
      const html = `
        <html>
          <body>
            <script>
              window.location.href = "https://aimharder.com/dashboard";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBe('https://aimharder.com/dashboard');
    });

    it('should extract URL from window.location.href with single quotes', () => {
      const html = `
        <html>
          <body>
            <script>
              window.location.href = '/redirect-page';
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBe('/redirect-page');
    });

    it('should extract URL from meta refresh tag', () => {
      const html = `
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=https://aimharder.com/home">
          </head>
          <body></body>
        </html>
      `;

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBe('https://aimharder.com/home');
    });

    it('should return null when no redirect found', () => {
      const html = `
        <html>
          <body>
            <p>No redirect here</p>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBeNull();
    });

    it('should prefer window.location.href over meta refresh', () => {
      const html = `
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=/meta-redirect">
          </head>
          <body>
            <script>
              window.location.href = "/script-redirect";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBe('/script-redirect');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<invalid html';

      const result = HtmlParserService.extractRedirectUrl(html);

      expect(result).toBeNull();
    });
  });

  describe('isLoginSuccessful', () => {
    it('should return true when iframe with setrefresh found', () => {
      const html = `
        <html>
          <body>
            <iframe src="/setrefresh?token=abc123"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(true);
    });

    it('should return true when iframe with token parameter found', () => {
      const html = `
        <html>
          <body>
            <iframe src="/some-path?token=test-token"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(true);
    });

    it('should return true when redirect script found', () => {
      const html = `
        <html>
          <body>
            <script>
              window.location.href = "/dashboard";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(true);
    });

    it('should return false when no success indicators', () => {
      const html = `
        <html>
          <body>
            <form>
              <input name="mail">
              <input name="pw">
            </form>
          </body>
        </html>
      `;

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(false);
    });

    it('should return false when iframe without token', () => {
      const html = `
        <html>
          <body>
            <iframe src="/some-other-page"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(false);
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<invalid';

      const result = HtmlParserService.isLoginSuccessful(html);

      expect(result).toBe(false);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract error from .error class', () => {
      const html = `
        <html>
          <body>
            <div class="error">Invalid credentials</div>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBe('Invalid credentials');
    });

    it('should extract error from .alert-danger class', () => {
      const html = `
        <html>
          <body>
            <div class="alert-danger">Login failed</div>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBe('Login failed');
    });

    it('should extract error from class containing "error"', () => {
      const html = `
        <html>
          <body>
            <div class="login-error-message">Password incorrect</div>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBe('Password incorrect');
    });

    it('should extract error from id containing "error"', () => {
      const html = `
        <html>
          <body>
            <div id="error-box">Something went wrong</div>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBe('Something went wrong');
    });

    it('should detect failed login when login form present', () => {
      const html = `
        <html>
          <body>
            <form action="/login">
              <input name="mail">
              <input name="pw">
            </form>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBe('Invalid credentials or login failed');
    });

    it('should return null when no error found', () => {
      const html = `
        <html>
          <body>
            <p>Success!</p>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBeNull();
    });

    it('should ignore empty error elements', () => {
      const html = `
        <html>
          <body>
            <div class="error">  </div>
            <p>Normal content</p>
          </body>
        </html>
      `;

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBeNull();
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<invalid html';

      const result = HtmlParserService.extractErrorMessage(html);

      expect(result).toBeNull();
    });
  });

  describe('validateHtmlResponse', () => {
    it('should return valid for successful login', () => {
      const html = `
        <html>
          <body>
            <iframe src="/setrefresh?token=abc123"></iframe>
            <script>
              window.location.href = "/dashboard";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: true,
        hasIframe: true,
        hasToken: true,
        hasRedirect: true,
        errorMessage: undefined,
      });
    });

    it('should return invalid when no iframe', () => {
      const html = `
        <html>
          <body>
            <p>No iframe</p>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: false,
        hasIframe: false,
        hasToken: false,
        hasRedirect: false,
        errorMessage: undefined,
      });
    });

    it('should return invalid when iframe has no token', () => {
      const html = `
        <html>
          <body>
            <iframe src="/some-page"></iframe>
            <script>
              window.location.href = "/dashboard";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: false,
        hasIframe: true,
        hasToken: false,
        hasRedirect: true,
        errorMessage: undefined,
      });
    });

    it('should return invalid when no redirect', () => {
      const html = `
        <html>
          <body>
            <iframe src="/setrefresh?token=abc123"></iframe>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: false,
        hasIframe: true,
        hasToken: true,
        hasRedirect: false,
        errorMessage: undefined,
      });
    });

    it('should return invalid when error message present', () => {
      const html = `
        <html>
          <body>
            <div class="error">Invalid credentials</div>
            <iframe src="/setrefresh?token=abc123"></iframe>
            <script>
              window.location.href = "/dashboard";
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: false,
        hasIframe: true,
        hasToken: true,
        hasRedirect: true,
        errorMessage: 'Invalid credentials',
      });
    });

    it('should return invalid for login form (failed login)', () => {
      const html = `
        <html>
          <body>
            <form action="/login">
              <input name="mail">
              <input name="pw">
            </form>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result).toEqual({
        isValid: false,
        hasIframe: false,
        hasToken: false,
        hasRedirect: false,
        errorMessage: 'Invalid credentials or login failed',
      });
    });

    it('should handle complex HTML with all indicators', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login Success</title>
          </head>
          <body>
            <div class="container">
              <iframe src="https://aimharder.com/setrefresh?token=xyz789&fingerprint=fp123"></iframe>
            </div>
            <script type="text/javascript">
              setTimeout(function() {
                window.location.href = "https://aimharder.com/dashboard";
              }, 1000);
            </script>
          </body>
        </html>
      `;

      const result = HtmlParserService.validateHtmlResponse(html);

      expect(result.isValid).toBe(true);
      expect(result.hasIframe).toBe(true);
      expect(result.hasToken).toBe(true);
      expect(result.hasRedirect).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });
  });
});
