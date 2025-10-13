import { AuthCookie } from '@/modules/auth/api/services/cookie.service';

export const mockAuthCookies: AuthCookie[] = [
  {
    name: 'PHPSESSID',
    value: 'test-session-id-12345',
    options: {
      domain: '.aimharder.com',
      path: '/',
      expires: new Date(Date.now() + 86400000), // 24 hours
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
    },
  },
  {
    name: 'amhrdrauth',
    value: 'test-auth-token-67890',
    options: {
      domain: '.aimharder.com',
      path: '/',
      expires: new Date(Date.now() + 86400000),
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
    },
  },
  {
    name: 'AWSALB',
    value: 'test-alb-cookie',
    options: {
      domain: '.aimharder.com',
      path: '/',
      expires: new Date(Date.now() + 86400000),
      httpOnly: false,
      secure: true,
      sameSite: 'none' as const,
    },
  },
  {
    name: 'AWSALBCORS',
    value: 'test-alb-cors-cookie',
    options: {
      domain: '.aimharder.com',
      path: '/',
      expires: new Date(Date.now() + 86400000),
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
    },
  },
];

export const mockSessionData = {
  email: 'test@example.com',
  token: 'test-token-abc123',
  cookies: mockAuthCookies,
  tokenData: {
    token: 'test-token-abc123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
  },
  createdAt: new Date().toISOString(),
  isAdmin: false,
};

export const mockLoginResponse = {
  success: true,
  data: {
    user: {
      id: 'test@example.com',
      email: 'test@example.com',
      name: 'Test User',
    },
    token: 'test-token-abc123',
  },
  cookies: mockAuthCookies,
};
