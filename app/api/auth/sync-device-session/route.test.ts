/**
 * Tests for Device Session Sync Endpoint
 *
 * CRITICAL: Verifies that token sync prevents localStorage/DB desync issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock services
vi.mock('@/modules/auth/api/services/supabase-session.service', () => ({
  SupabaseSessionService: {
    getDeviceSession: vi.fn(),
  },
}));

describe('POST /api/auth/sync-device-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if email or fingerprint is missing', async () => {
    const request = new NextRequest('http://localhost/api/auth/sync-device-session', {
      method: 'POST',
      body: JSON.stringify({ fingerprint: 'fp-123' }), // Missing email
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing email or fingerprint');
  });

  it('should return 404 if device session not found', async () => {
    const { SupabaseSessionService } = await import(
      '@/modules/auth/api/services/supabase-session.service'
    );

    vi.mocked(SupabaseSessionService.getDeviceSession).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/auth/sync-device-session', {
      method: 'POST',
      headers: {
        'x-user-email': 'test@example.com',
      },
      body: JSON.stringify({
        fingerprint: 'fp-123',
        currentToken: 'token-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Device session not found');
  });

  it('should return needsSync=true when tokens differ', async () => {
    const { SupabaseSessionService } = await import(
      '@/modules/auth/api/services/supabase-session.service'
    );

    const mockSession = {
      email: 'test@example.com',
      token: 'new-token-456', // Different from currentToken
      cookies: [{ name: 'cookie1', value: 'value1' }],
      updatedAt: new Date().toISOString(),
      tokenUpdateCount: 5,
      lastTokenUpdateDate: new Date().toISOString(),
      fingerprint: 'fp-123',
      sessionType: 'device' as const,
      createdAt: new Date().toISOString(),
      isAdmin: false,
    };

    vi.mocked(SupabaseSessionService.getDeviceSession).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/auth/sync-device-session', {
      method: 'POST',
      headers: {
        'x-user-email': 'test@example.com',
      },
      body: JSON.stringify({
        fingerprint: 'fp-123',
        currentToken: 'old-token-123', // Different from DB
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.needsSync).toBe(true);
    expect(data.token).toBe('new-token-456');
    expect(data.cookies).toEqual(mockSession.cookies);
  });

  it('should return needsSync=false when tokens match', async () => {
    const { SupabaseSessionService } = await import(
      '@/modules/auth/api/services/supabase-session.service'
    );

    const mockSession = {
      email: 'test@example.com',
      token: 'same-token-123', // Same as currentToken
      cookies: [{ name: 'cookie1', value: 'value1' }],
      updatedAt: new Date().toISOString(),
      tokenUpdateCount: 5,
      lastTokenUpdateDate: new Date().toISOString(),
      fingerprint: 'fp-123',
      sessionType: 'device' as const,
      createdAt: new Date().toISOString(),
      isAdmin: false,
    };

    vi.mocked(SupabaseSessionService.getDeviceSession).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/auth/sync-device-session', {
      method: 'POST',
      headers: {
        'x-user-email': 'test@example.com',
      },
      body: JSON.stringify({
        fingerprint: 'fp-123',
        currentToken: 'same-token-123', // Same as DB
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.needsSync).toBe(false);
    expect(data.token).toBe('same-token-123');
  });
});
