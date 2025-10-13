import { AuthCookie } from '@/modules/auth/api/services/cookie.service';

export const mockAuthCookies: AuthCookie[] = [
  {
    name: 'PHPSESSID',
    value: 'test-session-id-12345',
    domain: '.aimharder.com',
    path: '/',
    expires: new Date(Date.now() + 86400000), // 24 hours
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
  {
    name: 'amhrdrauth',
    value: 'test-auth-token-67890',
    domain: '.aimharder.com',
    path: '/',
    expires: new Date(Date.now() + 86400000),
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
  {
    name: 'AWSALB',
    value: 'test-alb-cookie',
    domain: '.aimharder.com',
    path: '/',
    expires: new Date(Date.now() + 86400000),
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  },
  {
    name: 'AWSALBCORS',
    value: 'test-alb-cors-cookie',
    domain: '.aimharder.com',
    path: '/',
    expires: new Date(Date.now() + 86400000),
    httpOnly: true,
    secure: true,
    sameSite: 'None',
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
