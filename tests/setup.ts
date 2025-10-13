import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.AIMHARDER_LOGIN_URL = 'https://test.aimharder.com/api/login';
  process.env.AIMHARDER_FINGERPRINT = 'test-fingerprint';
  process.env.QSTASH_URL = 'https://qstash.test.com';
  process.env.QSTASH_TOKEN = 'test-qstash-token';
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'test-signing-key';
  process.env.QSTASH_NEXT_SIGNING_KEY = 'test-next-signing-key';
  process.env.PREBOOKING_SECRET_KEY = 'test-secret-key-32-characters-long';
});

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));
