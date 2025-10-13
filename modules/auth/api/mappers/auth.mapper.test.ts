import { describe, it, expect } from 'vitest';
import { AuthMapper } from './auth.mapper';
import type { LoginRequest, LoginResponse } from '@/modules/auth/pods/login/models/login.model';
import type { LoginApiRequest, LoginApiResponse } from '../models/auth.api';

describe('AuthMapper', () => {
  describe('toLoginApiRequest', () => {
    it('should map login request to API format', () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = AuthMapper.toLoginApiRequest(loginRequest);

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should preserve email exactly as provided', () => {
      const loginRequest: LoginRequest = {
        email: 'TEST@EXAMPLE.COM',
        password: 'pass',
      };

      const result = AuthMapper.toLoginApiRequest(loginRequest);

      expect(result.email).toBe('TEST@EXAMPLE.COM');
    });

    it('should preserve password exactly as provided', () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'P@ssw0rd!#$%',
      };

      const result = AuthMapper.toLoginApiRequest(loginRequest);

      expect(result.password).toBe('P@ssw0rd!#$%');
    });

    it('should handle empty email', () => {
      const loginRequest: LoginRequest = {
        email: '',
        password: 'password',
      };

      const result = AuthMapper.toLoginApiRequest(loginRequest);

      expect(result.email).toBe('');
    });

    it('should handle empty password', () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: '',
      };

      const result = AuthMapper.toLoginApiRequest(loginRequest);

      expect(result.password).toBe('');
    });
  });

  describe('fromLoginApiResponse', () => {
    describe('success responses', () => {
      it('should map successful API response', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
            },
            token: 'jwt-token-123',
          },
          aimharderToken: 'aimharder-token-456',
          cookies: [
            { name: 'AWSALB', value: 'cookie-value-1' },
            { name: 'PHPSESSID', value: 'cookie-value-2' },
          ],
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
          token: 'jwt-token-123',
          aimharderToken: 'aimharder-token-456',
          cookies: [
            { name: 'AWSALB', value: 'cookie-value-1' },
            { name: 'PHPSESSID', value: 'cookie-value-2' },
          ],
        });
      });

      it('should map user fields correctly', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: {
            user: {
              id: '456',
              email: 'user@test.com',
              name: 'Another User',
            },
            token: 'token',
          },
          aimharderToken: 'ah-token',
          cookies: [],
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse) as LoginResponse & {
          success: true;
        };

        expect(result.success).toBe(true);
        expect(result.user.id).toBe('456');
        expect(result.user.email).toBe('user@test.com');
        expect(result.user.name).toBe('Another User');
      });

      it('should include all tokens', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: {
            user: {
              id: '1',
              email: 'test@example.com',
              name: 'User',
            },
            token: 'main-token',
          },
          aimharderToken: 'aimharder-token',
          cookies: [],
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse) as LoginResponse & {
          success: true;
        };

        expect(result.success).toBe(true);
        expect(result.token).toBe('main-token');
        expect(result.aimharderToken).toBe('aimharder-token');
      });

      it('should include cookies array', () => {
        const cookies = [
          { name: 'cookie1', value: 'value1' },
          { name: 'cookie2', value: 'value2' },
        ];

        const apiResponse: LoginApiResponse = {
          success: true,
          data: {
            user: { id: '1', email: 'test@example.com', name: 'User' },
            token: 'token',
          },
          aimharderToken: 'ah-token',
          cookies,
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse) as LoginResponse & {
          success: true;
        };

        expect(result.success).toBe(true);
        expect(result.cookies).toEqual(cookies);
        expect(result.cookies).toHaveLength(2);
      });

      it('should handle empty cookies array', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: {
            user: { id: '1', email: 'test@example.com', name: 'User' },
            token: 'token',
          },
          aimharderToken: 'ah-token',
          cookies: [],
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse) as LoginResponse & {
          success: true;
        };

        expect(result.success).toBe(true);
        expect(result.cookies).toEqual([]);
      });
    });

    describe('failure responses', () => {
      it('should map failed API response with error message', () => {
        const apiResponse: LoginApiResponse = {
          success: false,
          error: 'Invalid credentials',
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Invalid credentials',
        });
      });

      it('should use default error message when error not provided', () => {
        const apiResponse: LoginApiResponse = {
          success: false,
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Login failed',
        });
      });

      it('should handle success=false even with data present', () => {
        const apiResponse: LoginApiResponse = {
          success: false,
          data: {
            user: { id: '1', email: 'test@example.com', name: 'User' },
            token: 'token',
          },
          error: 'Session expired',
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Session expired',
        });
      });

      it('should handle null data', () => {
        const apiResponse: LoginApiResponse = {
          success: false,
          data: null,
          error: 'Authentication failed',
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Authentication failed',
        });
      });

      it('should handle undefined data', () => {
        const apiResponse: LoginApiResponse = {
          success: false,
          data: undefined,
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Login failed',
        });
      });

      it('should preserve custom error messages', () => {
        const errorMessages = [
          'Invalid email or password',
          'Account locked',
          'Too many login attempts',
          'Server error',
        ];

        errorMessages.forEach((errorMsg) => {
          const apiResponse: LoginApiResponse = {
            success: false,
            error: errorMsg,
          };

          const result = AuthMapper.fromLoginApiResponse(apiResponse);

          expect(result).toEqual({
            success: false,
            error: errorMsg,
          });
        });
      });
    });

    describe('edge cases', () => {
      it('should handle success=true but missing data', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: undefined,
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Login failed',
        });
      });

      it('should handle success=true with null data', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          data: null,
        };

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result).toEqual({
          success: false,
          error: 'Login failed',
        });
      });

      it('should require both success=true AND data to be successful', () => {
        const apiResponse: LoginApiResponse = {
          success: true,
          // data missing
        } as any;

        const result = AuthMapper.fromLoginApiResponse(apiResponse);

        expect(result.success).toBe(false);
      });
    });
  });
});
